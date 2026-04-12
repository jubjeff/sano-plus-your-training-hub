import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const payloadSchema = z.object({
  teacherId: z.string().uuid(),
  currentPeriodEndsAt: z.string().datetime(),
  provider: z.string().trim().min(2).default("manual"),
  externalSubscriptionId: z.string().trim().optional().nullable(),
  accessRequestId: z.string().uuid().optional().nullable(),
  amountCents: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).optional(),
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
    const payload = payloadSchema.parse(await request.json());
    const supabase = createServiceRoleClient();

    const { data: subscriptionData, error: subscriptionError } = await supabase.rpc("activate_pro_plan", {
      p_teacher_id: payload.teacherId,
      p_current_period_ends_at: payload.currentPeriodEndsAt,
      p_provider: payload.provider,
      p_external_subscription_id: payload.externalSubscriptionId ?? null,
      p_actor_user_id: null,
      p_metadata: payload.metadata ?? {},
    });

    if (subscriptionError) {
      return errorResponse(400, "activate_pro_failed", subscriptionError.message, subscriptionError.details);
    }

    if (payload.accessRequestId) {
      const { error: requestError } = await supabase
        .from("access_requests")
        .update({
          status: "approved",
          resolved_at: new Date().toISOString(),
          metadata: payload.metadata ?? {},
        })
        .eq("id", payload.accessRequestId);

      if (requestError) {
        return errorResponse(400, "access_request_update_failed", requestError.message, requestError.details);
      }
    }

    const { error: paymentError } = await supabase.from("payment_events").insert({
      teacher_id: payload.teacherId,
      subscription_id: subscriptionData.id,
      access_request_id: payload.accessRequestId ?? null,
      event_type: "payment_confirmation",
      status: "confirmed",
      provider: payload.provider,
      provider_reference: payload.externalSubscriptionId ?? null,
      amount_cents: payload.amountCents ?? null,
      currency: payload.currency ?? "BRL",
      paid_at: new Date().toISOString(),
      event_payload: payload.metadata ?? {},
    });

    if (paymentError) {
      return errorResponse(400, "payment_event_failed", paymentError.message, paymentError.details);
    }

    return jsonResponse({
      subscription: subscriptionData,
      message: "Plano Pro ativado com sucesso.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(422, "invalid_payload", "Payload invalido para ativacao do Pro.", error.flatten());
    }

    return errorResponse(500, "unexpected_error", error instanceof Error ? error.message : "Unexpected error.");
  }
});
