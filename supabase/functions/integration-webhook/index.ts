import { requireSharedSecret } from "../_shared/auth.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";
import { createErrorResponse, createOptionsResponse, createSuccessResponse, EdgeHttpError, ensureMethod, getRequestId, normalizeEdgeError, parseJsonBody } from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type IntegrationWebhookRequest = {
  provider: "payment_gateway" | "crm" | "messaging" | "custom";
  eventType: string;
  payload?: Record<string, unknown>;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return createOptionsResponse();
  }

  const requestId = getRequestId(request);

  try {
    ensureMethod(request, ["POST"]);
    requireSharedSecret(request, "x-webhook-secret", getEdgeRuntimeEnv().integrationWebhookSecret);
    const serviceRoleClient = createServiceRoleClient();

    const body = await parseJsonBody<IntegrationWebhookRequest>(request);
    if (!body.provider || !body.eventType) {
      throw new EdgeHttpError("invalid_webhook_event", "Provider e eventType sao obrigatorios.", 400);
    }

    const { data, error } = await serviceRoleClient
      .from("integration_events")
      .insert({
        provider: body.provider,
        event_type: body.eventType,
        payload: body.payload ?? {},
      })
      .select("id,received_at")
      .maybeSingle();

    if (error || !data) {
      throw new EdgeHttpError("integration_event_store_failed", error?.message ?? "Nao foi possivel registrar o webhook.", 400);
    }

    return createSuccessResponse(requestId, {
      provider: body.provider,
      eventType: body.eventType,
      eventId: data.id,
      receivedAt: data.received_at,
    }, 202);
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
