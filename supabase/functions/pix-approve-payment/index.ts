import {
  createErrorResponse,
  createOptionsResponse,
  createSuccessResponse,
  EdgeHttpError,
  ensureMethod,
  getRequestId,
  normalizeEdgeError,
  parseJsonBody,
} from "../_shared/http.ts";
import { requireCoachUser } from "../_shared/auth.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";
import { sendPaymentApprovedEmail, sendCoachNewSubscriptionEmail } from "../_shared/email.ts";

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Calcula o próximo vencimento: sempre +1 mês a partir do vencimento atual
 *  (se vencimento for no futuro) ou +1 mês a partir de hoje (se já vencido/nulo) */
function nextRenovacao(currentRenovacao: string | null | undefined): string {
  const now = new Date();
  const base =
    currentRenovacao && new Date(currentRenovacao + "T00:00:00Z") > now
      ? new Date(currentRenovacao + "T00:00:00Z")
      : now;
  base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString().slice(0, 10);
}

async function notifyCoach(
  db: ReturnType<typeof createServiceRoleClient>,
  teacherId: string | null,
  studentName: string,
  studentEmail: string,
  planName: string,
  amount: number,
  reviewLink: string,
) {
  if (!teacherId) return;
  const { data: teacher } = await db.from("teachers").select("user_id").eq("id", teacherId).maybeSingle();
  if (!teacher?.user_id) return;
  const { data: profile } = await db.from("profiles").select("email").eq("id", teacher.user_id).maybeSingle();
  if (!profile?.email) return;
  await sendCoachNewSubscriptionEmail({
    coachEmail: profile.email as string,
    studentName,
    studentEmail,
    planName,
    amount,
    reviewLink,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return createOptionsResponse();

  const requestId = getRequestId(request);

  try {
    ensureMethod(request, ["POST"]);
    const actor = await requireCoachUser(request);

    const { assinaturaId } = await parseJsonBody<{ assinaturaId: string }>(request);
    if (!assinaturaId?.trim()) {
      throw new EdgeHttpError("missing_params", "assinaturaId obrigatorio.", 400);
    }

    const db = createServiceRoleClient();
    const env = getEdgeRuntimeEnv();
    const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");

    const { data: assinatura } = await db
      .from("assinaturas")
      .select("id, status, anamnese_id, aluno_id, plano_id, teacher_id, valor_cobrado, data_renovacao")
      .eq("id", assinaturaId)
      .maybeSingle();

    if (!assinatura) throw new EdgeHttpError("not_found", "Assinatura nao encontrada.", 404);
    if (assinatura.status === "ativo") throw new EdgeHttpError("already_active", "Assinatura ja esta ativa.", 409);

    // Checagem de posse. `createServiceRoleClient()` ignora as policies de RLS, entao
    // a restricao que `coach_can_update_assinaturas` aplicaria (teacher_id in (select id
    // from teachers where user_id = auth.uid())) precisa ser refeita aqui na mao.
    // Sem isto, qualquer professor autenticado poderia aprovar a assinatura de outro
    // professor mandando um assinaturaId arbitrario no corpo da requisicao.
    const { data: callerTeacher } = await db
      .from("teachers")
      .select("id")
      .eq("user_id", actor.user.id)
      .maybeSingle();

    if (!callerTeacher?.id) {
      throw new EdgeHttpError("teacher_not_found", "Professor autenticado nao encontrado.", 404);
    }

    if (!assinatura.teacher_id || assinatura.teacher_id !== callerTeacher.id) {
      throw new EdgeHttpError("forbidden", "Esta assinatura nao pertence ao professor autenticado.", 403);
    }

    const { data: plano } = await db
      .from("planos")
      .select("id, nome, preco, periodo_dias")
      .eq("id", assinatura.plano_id)
      .maybeSingle();

    const today = new Date().toISOString().slice(0, 10);
    // +1 mês a partir do vencimento atual (se futuro) ou de hoje (se vencido)
    const renovacao = nextRenovacao(assinatura.data_renovacao as string | null);
    const valorCobrado = Number(assinatura.valor_cobrado ?? plano?.preco ?? 0);
    const planName = plano?.nome as string ?? "Mensalidade";
    const teacherId = assinatura.teacher_id as string | null;

    // ── CASO A: Renovação de aluno existente (aluno_id definido, sem anamnese) ──
    if (assinatura.aluno_id && !assinatura.anamnese_id) {
      const { data: student } = await db
        .from("students")
        .select("id, full_name, email, auth_user_id")
        .eq("id", assinatura.aluno_id)
        .maybeSingle();

      if (!student) throw new EdgeHttpError("student_not_found", "Aluno nao encontrado.", 404);

      // Atualiza datas de pagamento e comprovante do aluno
      await db.from("students").update({
        payment_due_date: renovacao,
        payment_last_paid_at: today,
        status: "active",
        proof_of_payment_status: "approved",
        proof_of_payment_sent_at: new Date().toISOString(),
      }).eq("id", student.id);

      // Ativa assinatura
      await db.from("assinaturas").update({
        status: "ativo",
        data_inicio: assinatura.aluno_id ? today : today,
        data_renovacao: renovacao,
        valor_cobrado: valorCobrado,
        payment_proof_status: "approved",
        payment_proof_approved_at: new Date().toISOString(),
      }).eq("id", assinaturaId);

      // E-mails
      await Promise.all([
        sendPaymentApprovedEmail({
          email: student.email as string,
          studentName: student.full_name as string,
          planName,
          amount: valorCobrado,
          renewalDate: renovacao,
          accessLink: `${appUrl}/`,
          temporaryPassword: null,
        }),
        notifyCoach(db, teacherId, student.full_name as string, student.email as string, planName, valorCobrado, `${appUrl}/assinaturas`),
      ]);

      return createSuccessResponse(requestId, {
        studentId: student.id,
        studentEmail: student.email,
        temporaryPassword: null,
        renovacao,
      });
    }

    // ── CASO B: Primeiro acesso via anamnese (sem aluno_id ainda) ────────────
    const { data: anamnese } = await db
      .from("anamneses")
      .select("id, full_name, email, teacher_id, student_id")
      .eq("id", assinatura.anamnese_id)
      .maybeSingle();

    if (!anamnese) throw new EdgeHttpError("data_missing", "Anamnese nao encontrada.", 404);

    let studentId = anamnese.student_id as string | null;
    let temporaryPassword: string | null = null;

    if (!studentId) {
      // Cria auth user + student record
      temporaryPassword = generateTemporaryPassword();
      const effectiveTeacherId = (teacherId ?? anamnese.teacher_id) as string | null;

      const { data: authUser, error: authErr } = await db.auth.admin.createUser({
        email: anamnese.email as string,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          role: "student",
          teacher_id: effectiveTeacherId,
          first_access_required: true,
          full_name: anamnese.full_name,
        },
      });

      if (authErr || !authUser.user) {
        throw new EdgeHttpError("auth_user_failed", `Falha ao criar usuario: ${authErr?.message ?? "erro desconhecido"}`, 500);
      }

      const { data: newStudent } = await db.from("students").insert({
        teacher_id: effectiveTeacherId,
        auth_user_id: authUser.user.id,
        full_name: anamnese.full_name,
        email: anamnese.email,
        goal: "Definido via anamnese",
        access_status: "temporary_password_pending",
        must_change_password: true,
        status: "active",
        temporary_password_generated_at: new Date().toISOString(),
        start_date: today,
        payment_due_date: renovacao,
        payment_last_paid_at: today,
      }).select("id").maybeSingle();

      if (newStudent?.id) {
        studentId = newStudent.id as string;
        await db.auth.admin.updateUserById(authUser.user.id, {
          user_metadata: {
            role: "student", teacher_id: effectiveTeacherId,
            student_id: studentId, first_access_required: true, full_name: anamnese.full_name,
          },
        });
        await db.from("anamneses").update({ student_id: studentId, status: "active" }).eq("id", anamnese.id);
      }
    } else {
      await db.from("students").update({
        payment_due_date: renovacao,
        payment_last_paid_at: today,
        proof_of_payment_status: "approved",
        proof_of_payment_sent_at: new Date().toISOString(),
      }).eq("id", studentId);
    }

    await db.from("assinaturas").update({
      status: "ativo",
      aluno_id: studentId ?? undefined,
      data_inicio: today,
      data_renovacao: renovacao,
      valor_cobrado: valorCobrado,
      payment_proof_status: "approved",
      payment_proof_approved_at: new Date().toISOString(),
    }).eq("id", assinaturaId);

    const accessLink = `${appUrl}/?access=student-first-login&email=${encodeURIComponent(anamnese.email as string)}`;

    await Promise.all([
      sendPaymentApprovedEmail({
        email: anamnese.email as string,
        studentName: anamnese.full_name as string,
        planName,
        amount: valorCobrado,
        renewalDate: renovacao,
        accessLink,
        temporaryPassword,
      }),
      notifyCoach(db, teacherId, anamnese.full_name as string, anamnese.email as string, planName, valorCobrado, `${appUrl}/assinaturas`),
    ]);

    return createSuccessResponse(requestId, {
      studentId,
      studentEmail: anamnese.email,
      temporaryPassword,
      renovacao,
    });
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
