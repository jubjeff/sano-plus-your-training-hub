import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createServiceRoleClient, requireUser } from "../_shared/supabase.ts";

const payloadSchema = z.object({
  teacherId: z.string().uuid().optional().nullable(),
  currentPeriodEndsAt: z.string().datetime().optional(),
  accessRequestId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Use POST para esta rota.");
  }

  try {
    const user = await requireUser(request);
    const payload = payloadSchema.parse(await request.json());
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase.rpc("confirm_mock_pro_payment", {
      p_teacher_id: payload.teacherId ?? null,
      p_current_period_ends_at: payload.currentPeriodEndsAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_access_request_id: payload.accessRequestId ?? null,
      p_actor_user_id: user.id,
      p_metadata: payload.metadata ?? {},
    });

    if (error) {
      return errorResponse(400, "mock_payment_confirmation_failed", error.message, error.details);
    }

    return jsonResponse({
      subscription: data,
      message: "Pagamento simulado com sucesso.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(422, "invalid_payload", "Payload invalido para confirmacao mockada do Pro.", error.flatten());
    }

    return errorResponse(401, "unexpected_error", error instanceof Error ? error.message : "Unexpected error.");
  }
});
