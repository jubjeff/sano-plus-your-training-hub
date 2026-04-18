import { requireSharedSecret } from "../_shared/auth.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";
import { createErrorResponse, createOptionsResponse, createSuccessResponse, EdgeHttpError, ensureMethod, getRequestId, normalizeEdgeError, parseJsonBody } from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type AutomationJob = "scan_overdue_students" | "build_coach_alerts" | "expire_trial_access";

type AutomationDispatchRequest = {
  job: AutomationJob;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
};

const supportedJobs = new Set<AutomationJob>([
  "scan_overdue_students",
  "build_coach_alerts",
  "expire_trial_access",
]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return createOptionsResponse();
  }

  const requestId = getRequestId(request);

  try {
    ensureMethod(request, ["POST"]);
    requireSharedSecret(request, "x-automation-secret", getEdgeRuntimeEnv().internalAutomationSecret);
    const serviceRoleClient = createServiceRoleClient();

    const body = await parseJsonBody<AutomationDispatchRequest>(request);
    if (!body.job || !supportedJobs.has(body.job)) {
      throw new EdgeHttpError("unsupported_job", "Job de automacao nao suportado.", 400, {
        supportedJobs: Array.from(supportedJobs),
      });
    }

    if (body.job === "scan_overdue_students") {
      const threshold = new Date();
      threshold.setUTCDate(threshold.getUTCDate() - 3);
      const { data, error } = await serviceRoleClient
        .from("students")
        .select("id")
        .lte("payment_due_date", threshold.toISOString().slice(0, 10))
        .neq("proof_of_payment_status", "submitted");

      if (error) {
        throw new EdgeHttpError("scan_overdue_students_failed", error.message, 400);
      }

      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        matchedStudents: data?.length ?? 0,
      });
    }

    if (body.job === "build_coach_alerts") {
      const { data, error } = await serviceRoleClient
        .from("students")
        .select("teacher_id")
        .neq("status", "inactive");

      if (error) {
        throw new EdgeHttpError("build_coach_alerts_failed", error.message, 400);
      }

      const teacherIds = new Set((data ?? []).map((row) => String(row.teacher_id)));
      return createSuccessResponse(requestId, {
        job: body.job,
        dryRun: body.dryRun ?? false,
        activeTeachers: teacherIds.size,
        activeStudents: data?.length ?? 0,
      });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await serviceRoleClient
      .from("teacher_subscriptions")
      .update({
        status: "expired",
        access_blocked: true,
        blocked_reason: "Trial expirado automaticamente.",
      })
      .eq("status", "trialing")
      .lte("trial_ends_at", nowIso)
      .select("id");

    if (error) {
      throw new EdgeHttpError("expire_trial_access_failed", error.message, 400);
    }

    return createSuccessResponse(requestId, {
      job: body.job,
      dryRun: body.dryRun ?? false,
      expiredSubscriptions: data?.length ?? 0,
    });
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
