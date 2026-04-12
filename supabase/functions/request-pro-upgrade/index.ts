import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createServiceRoleClient, requireUser } from "../_shared/supabase.ts";

const payloadSchema = z.object({
  message: z.string().trim().max(500).optional().nullable(),
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
    const user = await requireUser(request);
    const payload = payloadSchema.parse(await request.json());
    const supabase = createServiceRoleClient();

    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (teacherError || !teacher) {
      return errorResponse(404, "teacher_not_found", "Professor nao encontrado.");
    }

    const { data, error } = await supabase.rpc("request_pro_upgrade", {
      p_teacher_id: teacher.id,
      p_message: payload.message ?? null,
      p_amount_cents: payload.amountCents ?? null,
      p_currency: payload.currency ?? "BRL",
      p_metadata: payload.metadata ?? {},
    });

    if (error) {
      return errorResponse(400, "upgrade_request_failed", error.message, error.details);
    }

    return jsonResponse({
      request: data,
      message: "Solicitacao de upgrade registrada com sucesso.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(422, "invalid_payload", "Payload invalido para o upgrade.", error.flatten());
    }

    return errorResponse(401, "unauthorized", error instanceof Error ? error.message : "Unauthorized.");
  }
});
