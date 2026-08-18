// STATUS: PAUSADO — implementado e deployado, mas sem trafego: nada no app
// cria preferencias de pagamento no Mercado Pago (ver `mp-create-preference`),
// entao este webhook nunca e acionado. O fluxo ativo e o PIX manual.
//
// ATENCAO: esta funcao duplica o provisionamento pos-pagamento de
// `pix-approve-payment` (teachers, profiles, students, assinaturas, anamneses).
// Mudou a regra de provisionamento? Atualize os dois arquivos.
// Ver secao "Estado do Codigo" no CLAUDE.md.

import {
  createOptionsResponse,
  getRequestId,
  normalizeEdgeError,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";
import {
  getMpPayment,
  parseExternalRef,
  validateMpSignature,
  type MpPaymentStatus,
} from "../_shared/mercadopago.ts";
import {
  sendPaymentApprovedEmail,
  sendPaymentPendingEmail,
  sendPaymentRejectedEmail,
  sendCoachNewSubscriptionEmail,
  sendCoachPaymentRejectedEmail,
} from "../_shared/email.ts";

// Gera senha temporária
function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function addDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

type MpNotification = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

async function processPayment(paymentId: string, env: ReturnType<typeof getEdgeRuntimeEnv>) {
  const db = createServiceRoleClient();
  const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");

  // Busca detalhes reais no MP (não confiar só no webhook)
  const payment = await getMpPayment(paymentId);
  const status = payment.status as MpPaymentStatus;

  // Idempotência: já processamos este payment_id?
  const { data: existingByPaymentId } = await db
    .from("assinaturas")
    .select("id, status")
    .eq("mp_payment_id", String(payment.id))
    .maybeSingle();

  if (existingByPaymentId?.status === "ativo" && status === "approved") {
    console.log(`Payment ${payment.id} already processed as approved — skipping.`);
    return;
  }

  // Encontra a assinatura pelo external_reference
  const externalRef = payment.external_reference ?? "";
  const parsed = parseExternalRef(externalRef);

  if (!parsed) {
    console.warn(`Unrecognized external_reference: "${externalRef}" — ignoring.`);
    return;
  }

  const { anamnesisId, planoId } = parsed;

  const { data: assinatura } = await db
    .from("assinaturas")
    .select("id, status, anamnese_id, plano_id, teacher_id")
    .eq("anamnese_id", anamnesisId)
    .maybeSingle();

  // Busca anamnese e plano
  const [{ data: anamnese }, { data: plano }] = await Promise.all([
    db.from("anamneses").select("id, full_name, email, teacher_id, student_id").eq("id", anamnesisId).maybeSingle(),
    db.from("planos").select("id, nome, preco, periodo_dias").eq("id", planoId).maybeSingle(),
  ]);

  if (!anamnese || !plano) {
    console.error(`Anamnese (${anamnesisId}) ou plano (${planoId}) nao encontrado.`);
    return;
  }

  // Atualiza mp_payment_id e raw_payment na assinatura existente
  const assinaturaUpdate: Record<string, unknown> = {
    mp_payment_id: String(payment.id),
    mp_external_reference: externalRef,
    metodo_pagamento: payment.payment_method_id,
    mp_raw_payment: payment as unknown as Record<string, unknown>,
  };

  if (status === "approved") {
    // ── PAGAMENTO APROVADO ─────────────────────────────────────────────────────

    const today = new Date().toISOString().slice(0, 10);
    const renovacao = addDays(plano.periodo_dias);

    assinaturaUpdate.status = "ativo";
    assinaturaUpdate.data_inicio = today;
    assinaturaUpdate.data_renovacao = renovacao;
    assinaturaUpdate.valor_cobrado = payment.transaction_amount;

    let studentId = anamnese.student_id as string | null;
    let temporaryPassword: string | null = null;

    // Cria o aluno automaticamente se ainda não existe
    if (!studentId) {
      temporaryPassword = generateTemporaryPassword();

      const teacherId = (anamnese.teacher_id ?? assinatura?.teacher_id) as string | null;

      // Busca o user_id do professor para criar o aluno
      let teacherUserId: string | null = null;
      if (teacherId) {
        const { data: teacher } = await db.from("teachers").select("user_id").eq("id", teacherId).maybeSingle();
        teacherUserId = (teacher?.user_id as string | null) ?? null;
      }

      // Cria auth user para o aluno
      const { data: authUser, error: authErr } = await db.auth.admin.createUser({
        email: anamnese.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          role: "student",
          teacher_id: teacherId,
          first_access_required: true,
          full_name: anamnese.full_name,
        },
      });

      if (authErr || !authUser.user) {
        // Se e-mail já existe, tenta buscar o user existente
        console.warn("Auth user creation failed:", authErr?.message);
      } else {
        // Cria student record
        const { data: newStudent } = await db
          .from("students")
          .insert({
            teacher_id: teacherId,
            auth_user_id: authUser.user.id,
            full_name: anamnese.full_name,
            email: anamnese.email,
            goal: "Definido via anamnese",
            access_status: "temporary_password_pending",
            must_change_password: true,
            status: "active",
            temporary_password_generated_at: nowIso(),
            start_date: today,
            payment_due_date: renovacao,
            payment_last_paid_at: today,
          })
          .select("id")
          .maybeSingle();

        if (newStudent?.id) {
          studentId = newStudent.id as string;

          // Atualiza metadata do auth user com student_id
          await db.auth.admin.updateUserById(authUser.user.id, {
            user_metadata: {
              role: "student",
              teacher_id: teacherId,
              student_id: studentId,
              first_access_required: true,
              full_name: anamnese.full_name,
            },
          });

          // Vincula anamnese ao aluno
          await db
            .from("anamneses")
            .update({ student_id: studentId, status: "active" })
            .eq("id", anamnesisId);
        }
      }
    } else {
      // Aluno já existe: atualiza datas de pagamento
      await db
        .from("students")
        .update({ payment_due_date: renovacao, payment_last_paid_at: today })
        .eq("id", studentId);
    }

    // Vincula aluno à assinatura
    if (studentId) assinaturaUpdate.aluno_id = studentId;

    // E-mails
    const accessLink = `${appUrl}/?access=student-first-login&email=${encodeURIComponent(anamnese.email)}`;
    const planosPagLink = `${appUrl}/planos`;

    await Promise.all([
      sendPaymentApprovedEmail({
        email: anamnese.email,
        studentName: anamnese.full_name,
        planName: plano.nome,
        amount: payment.transaction_amount,
        renewalDate: renovacao,
        accessLink,
        temporaryPassword,
      }),
      // Notifica coach
      (async () => {
        const teacherId = anamnese.teacher_id as string | null;
        if (!teacherId) return;
        const { data: teacher } = await db.from("teachers").select("user_id").eq("id", teacherId).maybeSingle();
        if (!teacher?.user_id) return;
        const { data: profile } = await db.from("profiles").select("email").eq("id", teacher.user_id).maybeSingle();
        if (!profile?.email) return;
        await sendCoachNewSubscriptionEmail({
          coachEmail: profile.email as string,
          studentName: anamnese.full_name,
          studentEmail: anamnese.email,
          planName: plano.nome,
          amount: payment.transaction_amount,
          reviewLink: `${appUrl}/assinaturas`,
        });
      })(),
    ]);

  } else if (status === "pending" || status === "in_process") {
    // ── PAGAMENTO PENDENTE ─────────────────────────────────────────────────────
    assinaturaUpdate.status = "pendente";

    await sendPaymentPendingEmail({
      email: anamnese.email,
      studentName: anamnese.full_name,
      planName: plano.nome,
      amount: payment.transaction_amount,
    });

  } else if (status === "rejected" || status === "cancelled") {
    // ── PAGAMENTO REJEITADO / CANCELADO ──────────────────────────────────────
    assinaturaUpdate.status = status === "cancelled" ? "cancelado" : "recusado";
    if (status === "cancelled") assinaturaUpdate.data_cancelamento = nowIso();

    const retryLink = `${appUrl}/planos`;
    await Promise.all([
      sendPaymentRejectedEmail({
        email: anamnese.email,
        studentName: anamnese.full_name,
        planName: plano.nome,
        retryLink,
      }),
      // Notifica o professor
      (async () => {
        const teacherId = anamnese.teacher_id as string | null;
        if (!teacherId) return;
        const { data: teacher } = await db.from("teachers").select("user_id").eq("id", teacherId).maybeSingle();
        if (!teacher?.user_id) return;
        const { data: profile } = await db.from("profiles").select("email").eq("id", teacher.user_id).maybeSingle();
        if (!profile?.email) return;
        await sendCoachPaymentRejectedEmail({
          coachEmail: profile.email as string,
          studentName: anamnese.full_name,
          studentEmail: anamnese.email,
          planName: plano.nome,
          paymentMethod: payment.payment_method_id ?? null,
          reviewLink: `${appUrl}/assinaturas`,
        });
      })(),
    ]);

  } else if (status === "refunded" || status === "charged_back") {
    assinaturaUpdate.status = "reembolsado";
    assinaturaUpdate.data_cancelamento = nowIso();
  }

  // Persiste alterações na assinatura
  if (assinatura?.id) {
    await db.from("assinaturas").update(assinaturaUpdate).eq("id", assinatura.id);
  } else {
    // Caso não tenha sido criada via create-preference, cria agora
    await db.from("assinaturas").insert({
      anamnese_id: anamnesisId,
      plano_id: planoId,
      teacher_id: anamnese.teacher_id ?? null,
      ...assinaturaUpdate,
    });
  }

  console.log(`Payment ${payment.id} processed: status=${status}`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return createOptionsResponse();

  const requestId = getRequestId(request);
  const env = getEdgeRuntimeEnv();

  // Responde 200 imediatamente para evitar timeout do MP
  const response = new Response(JSON.stringify({ ok: true, requestId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  try {
    if (request.method !== "POST") return response;

    // Validação de assinatura do webhook
    if (env.mpWebhookSecret) {
      const xSignature = request.headers.get("x-signature") ?? "";
      const xRequestId = request.headers.get("x-request-id") ?? "";
      const rawBody = await request.text();
      let body: MpNotification;
      try { body = JSON.parse(rawBody); } catch { return response; }

      const dataId = String(body?.data?.id ?? "");
      const tsMatch = xSignature.match(/ts=(\d+)/);
      const v1Match = xSignature.match(/v1=([a-f0-9]+)/);

      if (tsMatch && v1Match && dataId) {
        const valid = await validateMpSignature({
          requestId: xRequestId,
          dataId,
          timestamp: tsMatch[1],
          v1: v1Match[1],
          secret: env.mpWebhookSecret,
        });

        if (!valid) {
          console.warn("Invalid MP webhook signature — rejecting.");
          return response; // Retorna 200 mas não processa
        }
      }

      // Processa apenas eventos de pagamento
      if (body.type !== "payment" || !dataId) return response;

      // Processa de forma assíncrona (fire-and-forget dentro da resposta)
      processPayment(dataId, env).catch((err) => {
        console.error("Webhook processing error:", normalizeEdgeError(err));
      });
    } else {
      // Sem secret configurado: aceita sem validação (apenas para desenvolvimento)
      const body = await request.json().catch(() => null) as MpNotification | null;
      const dataId = String(body?.data?.id ?? "");
      if (body?.type === "payment" && dataId) {
        processPayment(dataId, env).catch((err) => {
          console.error("Webhook processing error (no-secret):", normalizeEdgeError(err));
        });
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
  }

  return response;
});
