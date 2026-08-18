import {
  createErrorResponse,
  createOptionsResponse,
  createSuccessResponse,
  EdgeHttpError,
  getRequestId,
  normalizeEdgeError,
  parseJsonBody,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";
import { sendCoachPixPendingEmail } from "../_shared/email.ts";

// Modos disponíveis:
// info             – info PIX via anamnesisId + planoId (fluxo pré-cadastro)
// submit           – cria assinatura pendente via anamnese (fluxo pré-cadastro)
// info_by_teacher  – info PIX via teacherId (fluxo aluno autenticado)
// submit_renewal   – cria assinatura de renovação para aluno existente

async function getTeacherPixInfo(db: ReturnType<typeof createServiceRoleClient>, teacherId: string) {
  const { data: teacher } = await db
    .from("teachers")
    .select("pix_key, pix_key_type, monthly_fee, user_id")
    .eq("id", teacherId)
    .maybeSingle();

  if (!teacher?.pix_key) return null;

  let coachName = "Personal Trainer";
  if (teacher.user_id) {
    const { data: profile } = await db.from("profiles").select("full_name").eq("id", teacher.user_id).maybeSingle();
    if (profile?.full_name) coachName = profile.full_name as string;
  }

  return {
    pixKey: teacher.pix_key as string,
    pixKeyType: (teacher.pix_key_type as string | null) ?? null,
    monthlyFee: teacher.monthly_fee != null ? Number(teacher.monthly_fee) : null,
    coachName,
  };
}

async function notifyCoach(
  db: ReturnType<typeof createServiceRoleClient>,
  teacherId: string,
  studentName: string,
  studentEmail: string,
  planName: string,
  amount: number,
  payerNote: string | null,
  reviewLink: string,
) {
  const { data: teacher } = await db.from("teachers").select("user_id").eq("id", teacherId).maybeSingle();
  if (!teacher?.user_id) return;
  const { data: profile } = await db.from("profiles").select("email").eq("id", teacher.user_id).maybeSingle();
  if (!profile?.email) return;
  await sendCoachPixPendingEmail({
    coachEmail: profile.email as string,
    studentName,
    studentEmail,
    planName,
    amount,
    payerNote,
    reviewLink,
  }).catch(console.warn);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return createOptionsResponse();

  const requestId = getRequestId(request);

  try {
    const db = createServiceRoleClient();
    const env = getEdgeRuntimeEnv();
    const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");

    // ── GET: compatibilidade com query params ────────────────────────────────
    if (request.method === "GET") {
      const url = new URL(request.url);
      const anamnesisId = url.searchParams.get("anamnesisId") ?? "";
      const planoId = url.searchParams.get("planoId") ?? "";
      const teacherId = url.searchParams.get("teacherId") ?? "";

      if (teacherId) {
        const info = await getTeacherPixInfo(db, teacherId);
        if (!info) throw new EdgeHttpError("pix_not_configured", "O personal ainda nao configurou a chave PIX.", 422);
        return createSuccessResponse(requestId, info);
      }

      if (!anamnesisId || !planoId) throw new EdgeHttpError("missing_params", "Parametros obrigatorios ausentes.", 400);

      const [{ data: anamnese }, { data: plano }] = await Promise.all([
        db.from("anamneses").select("id, full_name, email, teacher_id").eq("id", anamnesisId).maybeSingle(),
        db.from("planos").select("id, nome, preco, periodo_dias, ativo").eq("id", planoId).maybeSingle(),
      ]);
      if (!anamnese) throw new EdgeHttpError("anamnese_not_found", "Anamnese nao encontrada.", 404);
      if (!plano?.ativo) throw new EdgeHttpError("plano_not_found", "Plano nao encontrado.", 404);

      const info = await getTeacherPixInfo(db, anamnese.teacher_id as string);
      if (!info) throw new EdgeHttpError("pix_not_configured", "O personal ainda nao configurou a chave PIX.", 422);
      return createSuccessResponse(requestId, { ...info, planName: plano.nome, amount: Number(plano.preco) });
    }

    // ── POST ────────────────────────────────────────────────────────────────
    const body = await parseJsonBody<{
      mode?: string;
      anamnesisId?: string;
      planoId?: string;
      teacherId?: string;
      studentId?: string;
      payerNote?: string;
      proofUrl?: string;
    }>(request);

    const mode = body.mode ?? "info";
    const payerNote = body.payerNote?.trim() || null;
    const proofUrl = body.proofUrl?.trim() || null;

    // ── MODO: get_upload_url ──────────────────────────────────────────────
    // Gera URL assinada para upload de comprovante (service role bypassa RLS do bucket)
    if (mode === "get_upload_url") {
      const studentId = body.studentId?.trim();
      const fileExt = (body as { fileExt?: string }).fileExt?.trim() ?? "jpg";
      if (!studentId) throw new EdgeHttpError("missing_params", "studentId obrigatorio.", 400);

      const path = `student-renewals/${studentId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await db.storage
        .from("payment-proofs")
        .createSignedUploadUrl(path);

      if (uploadErr || !uploadData) {
        throw new EdgeHttpError("upload_url_failed", `Falha ao gerar URL de upload: ${uploadErr?.message ?? "erro desconhecido"}`, 500);
      }

      // URL de leitura assinada (1 ano) gerada ao mesmo tempo que a URL de upload
      const { data: readData } = await db.storage
        .from("payment-proofs")
        .createSignedUrl(path, 365 * 24 * 60 * 60);

      return createSuccessResponse(requestId, {
        signedUrl: uploadData.signedUrl,
        token: uploadData.token,
        path,
        readUrl: readData?.signedUrl ?? null,
      });
    }

    // ── MODO: info_by_teacher ──────────────────────────────────────────────
    if (mode === "info_by_teacher") {
      const teacherId = body.teacherId?.trim();
      if (!teacherId) throw new EdgeHttpError("missing_params", "teacherId obrigatorio.", 400);

      const info = await getTeacherPixInfo(db, teacherId);
      if (!info) throw new EdgeHttpError("pix_not_configured", "O personal ainda nao configurou a chave PIX.", 422);

      // Prioridade: monthly_fee do professor > valor da assinatura existente
      let amount: number | null = info.monthlyFee ?? null;
      let planName = "Mensalidade";

      if (amount == null) {
        const studentId = body.studentId?.trim();
        if (studentId) {
          const { data: ass } = await db
            .from("assinaturas")
            .select("valor_cobrado, planos(nome)")
            .eq("aluno_id", studentId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (ass?.valor_cobrado) {
            amount = Number(ass.valor_cobrado);
            planName = (ass.planos as { nome: string } | null)?.nome ?? "Mensalidade";
          }
        }
      }

      return createSuccessResponse(requestId, { ...info, amount, planName });
    }

    // ── MODO: submit_renewal ───────────────────────────────────────────────
    if (mode === "submit_renewal") {
      const teacherId = body.teacherId?.trim();
      const studentId = body.studentId?.trim();
      if (!teacherId || !studentId) throw new EdgeHttpError("missing_params", "teacherId e studentId obrigatorios.", 400);

      // Busca dados do aluno
      const { data: student } = await db.from("students").select("id, full_name, email").eq("id", studentId).maybeSingle();
      if (!student) throw new EdgeHttpError("student_not_found", "Aluno nao encontrado.", 404);

      // Busca monthly_fee do professor (fonte primária de valor)
      const teacherInfo = await getTeacherPixInfo(db, teacherId);
      const teacherFee = teacherInfo?.monthlyFee ?? null;

      // Busca a assinatura mais recente do aluno (ativo OU pendente)
      // — 1 assinatura por aluno, atualizada a cada ciclo (sem duplicatas)
      const { data: existingAss } = await db
        .from("assinaturas")
        .select("id, status, plano_id, valor_cobrado, planos(nome, preco)")
        .eq("aluno_id", studentId)
        .in("status", ["ativo", "pendente"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let planoId: string;
      let valor: number;
      let planName: string;

      if (existingAss?.plano_id) {
        planoId = existingAss.plano_id as string;
        valor = teacherFee ?? Number((existingAss.planos as { preco: number } | null)?.preco ?? existingAss.valor_cobrado ?? 0);
        planName = (existingAss.planos as { nome: string } | null)?.nome ?? "Mensalidade";
      } else {
        const { data: firstPlan } = await db.from("planos").select("id, nome, preco").eq("ativo", true).order("ordem").limit(1).maybeSingle();
        if (!firstPlan) throw new EdgeHttpError("no_plan", "Nenhum plano disponivel.", 404);
        planoId = firstPlan.id as string;
        valor = teacherFee ?? Number(firstPlan.preco);
        planName = firstPlan.nome as string;
      }

      const proofPayload = {
        status: "pendente",
        metodo_pagamento: "pix",
        valor_cobrado: valor,
        payer_note: payerNote,
        payment_proof_url: proofUrl,
        payment_proof_status: "submitted",
        payment_proof_submitted_at: new Date().toISOString(),
      };

      if (existingAss?.id) {
        // ✅ Atualiza o registro existente (ativo → pendente aguardando aprovação)
        await db.from("assinaturas").update(proofPayload).eq("id", existingAss.id);
      } else {
        // Primeira assinatura do aluno: cria novo registro
        await db.from("assinaturas").insert({
          aluno_id: studentId,
          teacher_id: teacherId,
          plano_id: planoId,
          ...proofPayload,
        });
      }

      // Sincroniza proof_of_payment_status no students para refletir no portal do aluno
      await db.from("students").update({
        proof_of_payment_status: "submitted",
        proof_of_payment_sent_at: new Date().toISOString(),
      }).eq("id", studentId);

      await notifyCoach(db, teacherId, student.full_name as string, student.email as string, planName, valor, payerNote, `${appUrl}/assinaturas`);

      return createSuccessResponse(requestId, { ok: true });
    }

    // ── MODOS: info / submit (fluxo pré-cadastro via anamnese) ──────────────
    const anamnesisId = body.anamnesisId?.trim() ?? "";
    const planoId = body.planoId?.trim() ?? "";

    if (!anamnesisId || !planoId) throw new EdgeHttpError("missing_params", "anamnesisId e planoId sao obrigatorios.", 400);

    const [{ data: anamnese }, { data: plano }] = await Promise.all([
      db.from("anamneses").select("id, full_name, email, teacher_id").eq("id", anamnesisId).maybeSingle(),
      db.from("planos").select("id, nome, preco, periodo_dias, ativo").eq("id", planoId).maybeSingle(),
    ]);

    if (!anamnese) throw new EdgeHttpError("anamnese_not_found", "Anamnese nao encontrada.", 404);
    if (!plano?.ativo) throw new EdgeHttpError("plano_not_found", "Plano nao encontrado ou inativo.", 404);

    const teacherId = anamnese.teacher_id as string | null;
    const info = teacherId ? await getTeacherPixInfo(db, teacherId) : null;
    if (!info) throw new EdgeHttpError("pix_not_configured", "O personal ainda nao configurou a chave PIX.", 422);

    if (mode === "info") {
      return createSuccessResponse(requestId, { ...info, planName: plano.nome, amount: Number(plano.preco) });
    }

    // mode === "submit"
    const { data: existing } = await db
      .from("assinaturas").select("id, status")
      .eq("anamnese_id", anamnesisId).in("status", ["ativo", "pendente"]).maybeSingle();

    if (existing?.status === "ativo") throw new EdgeHttpError("already_active", "Assinatura ja ativa.", 409);

    let assinaturaId: string;
    if (existing?.status === "pendente") {
      await db.from("assinaturas").update({
        plano_id: planoId, valor_cobrado: Number(plano.preco), metodo_pagamento: "pix",
        payer_note: payerNote, payment_proof_status: "submitted",
        payment_proof_submitted_at: new Date().toISOString(),
      }).eq("id", existing.id);
      assinaturaId = existing.id as string;
    } else {
      const { data: inserted } = await db.from("assinaturas").insert({
        anamnese_id: anamnesisId, plano_id: planoId, teacher_id: teacherId,
        status: "pendente", metodo_pagamento: "pix", valor_cobrado: Number(plano.preco),
        payer_note: payerNote, payment_proof_status: "submitted",
        payment_proof_submitted_at: new Date().toISOString(),
      }).select("id").maybeSingle();
      if (!inserted?.id) throw new EdgeHttpError("insert_failed", "Falha ao registrar assinatura.", 500);
      assinaturaId = inserted.id as string;
    }

    if (teacherId) {
      await notifyCoach(db, teacherId, anamnese.full_name as string, anamnese.email as string, plano.nome as string, Number(plano.preco), payerNote, `${appUrl}/assinaturas`);
    }

    return createSuccessResponse(requestId, { assinaturaId });
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
