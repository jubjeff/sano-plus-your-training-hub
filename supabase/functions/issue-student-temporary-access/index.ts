import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createAnonClient, createServiceRoleClient, requireUser } from "../_shared/supabase.ts";

const payloadSchema = z.object({
  studentId: z.string().uuid(),
});

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

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
    const authHeader = request.headers.get("Authorization");
    const anonClient = createAnonClient(authHeader);
    const serviceClient = createServiceRoleClient();

    const { data: teacherData, error: teacherError } = await anonClient
      .from("teachers")
      .select("id")
      .single();

    if (teacherError || !teacherData?.id) {
      return errorResponse(403, "teacher_not_found", teacherError?.message ?? "Professor nao encontrado.");
    }

    const { data: studentRows, error: studentError } = await anonClient
      .from("students")
      .select("id, teacher_id, auth_user_id, full_name, email, birth_date, phone, notes")
      .eq("id", payload.studentId)
      .limit(1);

    if (studentError) {
      return errorResponse(400, "student_lookup_failed", studentError.message);
    }

    const student = studentRows?.[0];
    if (!student || student.teacher_id !== teacherData.id) {
      return errorResponse(404, "student_not_found", "Aluno nao encontrado.");
    }

    if (!student.email) {
      return errorResponse(422, "student_email_required", "O aluno precisa ter um e-mail para receber acesso.");
    }

    const temporaryPassword = generateTemporaryPassword();
    const metadata = {
      role: "student",
      student_id: student.id,
      teacher_id: student.teacher_id,
      first_access_required: true,
    };

    let authUserId = student.auth_user_id as string | null;

    if (authUserId) {
      const { error: updateAuthError } = await serviceClient.auth.admin.updateUserById(authUserId, {
        email: student.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (updateAuthError) {
        return errorResponse(400, "student_auth_update_failed", updateAuthError.message);
      }
    } else {
      const { data: createdUser, error: createAuthError } = await serviceClient.auth.admin.createUser({
        email: student.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (createAuthError || !createdUser.user) {
        return errorResponse(400, "student_auth_create_failed", createAuthError?.message ?? "Nao foi possivel criar a conta do aluno.");
      }

      authUserId = createdUser.user.id;
    }

    const generatedAt = new Date().toISOString();
    const { error: updateStudentError } = await serviceClient
      .from("students")
      .update({
        auth_user_id: authUserId,
        access_status: "temporary_password_pending",
        status: "active",
        temporary_password_generated_at: generatedAt,
        first_access_completed_at: null,
      })
      .eq("id", student.id);

    if (updateStudentError) {
      return errorResponse(400, "student_access_update_failed", updateStudentError.message);
    }

    return jsonResponse({
      studentId: student.id,
      studentName: student.full_name,
      email: student.email,
      temporaryPassword,
      generatedAt,
      issuedBy: user.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(422, "invalid_payload", "Payload invalido.", error.flatten());
    }

    return errorResponse(401, "unauthorized", error instanceof Error ? error.message : "Unauthorized.");
  }
});
