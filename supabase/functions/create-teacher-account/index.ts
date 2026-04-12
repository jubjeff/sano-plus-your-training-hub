import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createServiceRoleClient, requireUser } from "../_shared/supabase.ts";

const payloadSchema = z.object({
  fullName: z.string().trim().min(3),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cpf: z.string().min(11),
  phone: z.string().trim().optional().nullable(),
  selectedPlan: z.enum(["basic", "pro"]),
  mockProPaymentConfirmed: z.boolean().optional(),
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
    if (!user.email) {
      return errorResponse(400, "missing_email", "Nao foi possivel identificar o e-mail da conta autenticada.");
    }

    const payload = payloadSchema.parse(await request.json());
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase.rpc("provision_teacher_account", {
      p_user_id: user.id,
      p_email: user.email,
      p_full_name: payload.fullName,
      p_birth_date: payload.birthDate,
      p_cpf: payload.cpf,
      p_phone: payload.phone ?? null,
      p_selected_plan: payload.selectedPlan,
      p_mock_pro_payment_confirmed: Boolean(payload.mockProPaymentConfirmed),
      p_metadata: payload.metadata ?? {},
    });

    if (error) {
      return errorResponse(400, "teacher_account_provision_failed", error.message, error.details);
    }

    const snapshot = Array.isArray(data) ? data[0] : data;
    return jsonResponse({
      teacher: {
        userId: user.id,
        email: user.email,
        teacherId: snapshot.teacher_id,
      },
      subscription: snapshot,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(422, "invalid_payload", "Payload invalido para criacao da conta.", error.flatten());
    }

    return errorResponse(401, "unauthorized", error instanceof Error ? error.message : "Unauthorized.");
  }
});
