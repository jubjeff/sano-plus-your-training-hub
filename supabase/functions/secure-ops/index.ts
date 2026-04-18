import { requireSharedSecret } from "../_shared/auth.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";
import { createErrorResponse, createOptionsResponse, createSuccessResponse, EdgeHttpError, ensureMethod, getRequestId, normalizeEdgeError, parseJsonBody } from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type SecureOperation = "provision_teacher_account" | "rotate_student_access" | "reconcile_subscription_state";

type SecureOpsRequest = {
  operation: SecureOperation;
  payload?: Record<string, unknown>;
};

const supportedOperations = new Set<SecureOperation>([
  "provision_teacher_account",
  "rotate_student_access",
  "reconcile_subscription_state",
]);

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return createOptionsResponse();
  }

  const requestId = getRequestId(request);

  try {
    ensureMethod(request, ["POST"]);
    requireSharedSecret(request, "x-secure-ops-secret", getEdgeRuntimeEnv().secureOpsSecret);

    const body = await parseJsonBody<SecureOpsRequest>(request);
    if (!body.operation || !supportedOperations.has(body.operation)) {
      throw new EdgeHttpError("unsupported_operation", "Operacao segura nao suportada.", 400, {
        supportedOperations: Array.from(supportedOperations),
      });
    }

    const serviceRoleClient = createServiceRoleClient();

    if (body.operation === "provision_teacher_account") {
      const userId = String(body.payload?.userId ?? "").trim();
      if (!userId) {
        throw new EdgeHttpError("invalid_user_id", "userId e obrigatorio.", 400);
      }

      const { data, error } = await serviceRoleClient
        .from("profiles")
        .select("id,cpf,role")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data?.id) {
        throw new EdgeHttpError("profile_lookup_failed", error?.message ?? "Perfil nao encontrado.", 404);
      }

      if (data.role !== "professor") {
        throw new EdgeHttpError("invalid_role", "O perfil informado nao pertence a um professor.", 400);
      }

      const { data: teacher, error: teacherError } = await serviceRoleClient
        .from("teachers")
        .upsert({
          user_id: userId,
          onboarding_completed: true,
        }, { onConflict: "user_id" })
        .select("id")
        .maybeSingle();

      if (teacherError || !teacher?.id) {
        throw new EdgeHttpError("teacher_upsert_failed", teacherError?.message ?? "Nao foi possivel provisionar o professor.", 400);
      }

      const { data: subscription, error: provisionError } = await serviceRoleClient
        .from("teacher_subscriptions")
        .upsert({
          teacher_id: teacher.id,
          plan_type: "basic",
          status: "trialing",
          access_blocked: false,
          trial_granted: true,
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          student_limit: 1,
          metadata: {
            provisioned_by_secure_ops: true,
            cpf: data.cpf,
          },
        }, { onConflict: "teacher_id" })
        .select("*")
        .maybeSingle();

      if (provisionError) {
        throw new EdgeHttpError("teacher_provision_failed", provisionError.message, 400, provisionError.details);
      }

      return createSuccessResponse(requestId, {
        operation: body.operation,
        result: subscription,
      });
    }

    if (body.operation === "rotate_student_access") {
      const teacherId = String(body.payload?.teacherId ?? "").trim();
      const studentId = String(body.payload?.studentId ?? "").trim();
      if (!teacherId || !studentId) {
        throw new EdgeHttpError("invalid_rotate_payload", "teacherId e studentId sao obrigatorios.", 400);
      }

      const temporaryPassword = generateTemporaryPassword();
      const { data: student, error: studentError } = await serviceRoleClient
        .from("students")
        .select("auth_user_id,email")
        .eq("id", studentId)
        .eq("teacher_id", teacherId)
        .maybeSingle();

      if (studentError || !student?.auth_user_id || !student.email) {
        throw new EdgeHttpError("student_access_rotation_failed", studentError?.message ?? "Aluno sem conta vinculada.", 400);
      }

      const { error: updateError } = await serviceRoleClient.auth.admin.updateUserById(String(student.auth_user_id), {
        email: String(student.email),
        password: temporaryPassword,
        email_confirm: true,
      });

      if (updateError) {
        throw new EdgeHttpError("student_auth_rotation_failed", updateError.message, 400);
      }

      return createSuccessResponse(requestId, {
        operation: body.operation,
        studentId,
        temporaryPassword,
      });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await serviceRoleClient
      .from("teacher_subscriptions")
      .update({
        status: "expired",
        access_blocked: true,
        blocked_reason: "Assinatura expirada reconciliada pelo secure-ops.",
      })
      .eq("status", "active")
      .lte("current_period_ends_at", nowIso)
      .select("id");

    if (error) {
      throw new EdgeHttpError("subscription_reconciliation_failed", error.message, 400);
    }

    return createSuccessResponse(requestId, {
      operation: body.operation,
      reconciledSubscriptions: data?.length ?? 0,
    });
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
