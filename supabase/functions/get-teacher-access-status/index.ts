import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createServiceRoleClient, requireUser } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return errorResponse(405, "method_not_allowed", "Use GET para esta rota.");
  }

  try {
    const user = await requireUser(request);
    const supabase = createServiceRoleClient();

    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (teacherError || !teacher) {
      return errorResponse(404, "teacher_not_found", "Professor nao encontrado.");
    }

    const { data, error } = await supabase.rpc("get_teacher_access_snapshot", {
      teacher_uuid: teacher.id,
    });

    if (error) {
      return errorResponse(400, "access_status_failed", error.message, error.details);
    }

    const snapshot = Array.isArray(data) ? data[0] : data;
    return jsonResponse({
      teacherId: teacher.id,
      access: snapshot,
      message: snapshot?.access_message ?? "Acesso consultado com sucesso.",
    });
  } catch (error) {
    return errorResponse(401, "unauthorized", error instanceof Error ? error.message : "Unauthorized.");
  }
});
