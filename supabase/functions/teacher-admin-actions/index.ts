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
import { sendStudentTemporaryAccessEmail } from "../_shared/email.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type TeacherAdminAction =
  | "create_student_with_temporary_password"
  | "reset_student_temporary_access"
  | "set_student_status"
  | "mark_payment_received"
  | "approve_payment_proof"
  | "activate_coach_pro_plan";

type TeacherAdminActionRequest = {
  action: TeacherAdminAction;
  payload: Record<string, unknown>;
};

const supportedActions = new Set<TeacherAdminAction>([
  "create_student_with_temporary_password",
  "reset_student_temporary_access",
  "set_student_status",
  "mark_payment_received",
  "approve_payment_proof",
  "activate_coach_pro_plan",
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalPhone(value: unknown) {
  const normalized = String(value ?? "").replace(/\D/g, "");
  return normalized.length > 0 ? normalized : null;
}

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function resolveAppOrigin(request: Request) {
  const originCandidates = [
    Deno.env.get("APP_URL")?.trim() ?? null,
    request.headers.get("origin")?.trim() ?? null,
    request.headers.get("referer")?.trim() ?? null,
  ].filter(Boolean) as string[];

  for (const candidate of originCandidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.hostname === "localhost") {
        return url.origin;
      }
    } catch {
      // try next candidate
    }
  }

  return "https://sanoplus.online";
}

function buildStudentAccessLink(request: Request, email: string) {
  const url = new URL("/", resolveAppOrigin(request));
  url.searchParams.set("access", "student-first-login");
  url.searchParams.set("email", email);
  return url.toString();
}

async function lookupTeacherId(serviceRoleClient: ReturnType<typeof createServiceRoleClient>, userId: string) {
  return serviceRoleClient
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
}

async function bootstrapTeacherAccount(
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  userId: string,
) {
  const { data: profile, error: profileError } = await serviceRoleClient
    .from("profiles")
    .select("id, role, cpf")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile?.id) {
    throw new EdgeHttpError("teacher_profile_not_found", "Perfil do professor autenticado nao encontrado.", 404, {
      reason: profileError?.message ?? null,
      userId,
    });
  }

  if (String(profile.role ?? "").toLowerCase() !== "professor") {
    throw new EdgeHttpError("invalid_teacher_role", "O usuario autenticado nao possui papel de professor.", 403, {
      userId,
      role: profile.role ?? null,
    });
  }

  const { data: authUserData, error: authUserError } = await serviceRoleClient.auth.admin.getUserById(userId);
  if (authUserError || !authUserData.user) {
    throw new EdgeHttpError("teacher_auth_lookup_failed", "Nao foi possivel carregar os metadados do professor autenticado.", 500, {
      reason: authUserError?.message ?? null,
      userId,
    });
  }

  const metadata = (authUserData.user.user_metadata ?? {}) as Record<string, unknown>;
  const selectedPlan = String(metadata.selected_plan ?? "basic").trim().toLowerCase() || "basic";
  const mockPaymentConfirmed = Boolean(metadata.mockProPaymentConfirmed ?? metadata.mock_pro_payment_confirmed);
  const cpf = String(profile.cpf ?? metadata.cpf ?? "").trim();

  const { data: teacher, error: teacherError } = await serviceRoleClient
    .from("teachers")
    .upsert(
      {
        user_id: userId,
        onboarding_completed: true,
        metadata: {
          selected_plan: selectedPlan,
          bootstrap_source: "teacher_admin_actions",
        },
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .maybeSingle();

  if (teacherError || !teacher?.id) {
    throw new EdgeHttpError("teacher_upsert_failed", "Nao foi possivel preparar o cadastro do professor autenticado.", 500, {
      reason: teacherError?.message ?? null,
      userId,
    });
  }

  const { data: existingSubscription, error: subscriptionLookupError } = await serviceRoleClient
    .from("teacher_subscriptions")
    .select("id")
    .eq("teacher_id", teacher.id)
    .maybeSingle();

  if (subscriptionLookupError) {
    throw new EdgeHttpError("teacher_subscription_lookup_failed", "Nao foi possivel verificar a assinatura do professor autenticado.", 500, {
      reason: subscriptionLookupError.message,
      teacherId: teacher.id,
    });
  }

  if (!existingSubscription?.id) {
    const { error: provisionError } = await serviceRoleClient.rpc("create_teacher_subscription_from_selection", {
      p_teacher_id: teacher.id,
      p_cpf: cpf,
      p_selected_plan: selectedPlan,
      p_mock_payment_confirmed: selectedPlan === "pro" ? mockPaymentConfirmed : false,
      p_origin: "edge:teacher_admin_actions_bootstrap",
    });

    if (provisionError) {
      throw new EdgeHttpError("teacher_subscription_bootstrap_failed", "Nao foi possivel criar a assinatura/base de acesso do professor autenticado.", 500, {
        reason: provisionError.message,
        teacherId: teacher.id,
        selectedPlan,
      });
    }
  }

  return teacher.id as string;
}

async function requireTeacherId(
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  userId: string,
) {
  let { data, error } = await lookupTeacherId(serviceRoleClient, userId);

  if (!data?.id) {
    const teacherId = await bootstrapTeacherAccount(serviceRoleClient, userId);
    ({ data, error } = await lookupTeacherId(serviceRoleClient, userId));

    if (!data?.id && teacherId) {
      data = { id: teacherId };
    }
  }

  if (error || !data?.id) {
    throw new EdgeHttpError("teacher_not_found", "Professor autenticado nao encontrado.", 404, {
      reason: error?.message ?? null,
      userId,
    });
  }

  return data.id as string;
}

async function assertTeacherCanAddStudent(serviceRoleClient: ReturnType<typeof createServiceRoleClient>, teacherId: string) {
  const { error } = await serviceRoleClient.rpc("assert_teacher_can_add_student", {
    p_teacher_id: teacherId,
  });

  if (error) {
    throw new EdgeHttpError("teacher_cannot_add_student", error.message, 403);
  }
}

async function deleteAuthUserBestEffort(serviceRoleClient: ReturnType<typeof createServiceRoleClient>, userId: string | null) {
  if (!userId) {
    return;
  }

  try {
    await serviceRoleClient.auth.admin.deleteUser(userId);
  } catch {
    // noop cleanup
  }
}

async function deleteStudentBestEffort(serviceRoleClient: ReturnType<typeof createServiceRoleClient>, studentId: string | null) {
  if (!studentId) {
    return;
  }

  try {
    await serviceRoleClient.from("students").delete().eq("id", studentId);
  } catch {
    // noop cleanup
  }
}

function buildStudentAuthMetadata(params: { teacherId: string; studentId?: string | null; fullName: string }) {
  return {
    role: "student",
    teacher_id: params.teacherId,
    student_id: params.studentId ?? null,
    first_access_required: true,
    full_name: params.fullName,
  };
}

function normalizeCreateStudentPayload(payload: Record<string, unknown>) {
  const fullName = normalizeOptionalString(payload.fullName);
  const email = normalizeEmail(payload.email);
  const startDate = normalizeOptionalString(payload.startDate);

  if (!fullName || fullName.length < 3) {
    throw new EdgeHttpError("invalid_full_name", "Informe o nome completo do aluno.", 400);
  }

  if (!email || !email.includes("@")) {
    throw new EdgeHttpError("invalid_email", "Informe um e-mail valido para o aluno.", 400);
  }

  if (!startDate) {
    throw new EdgeHttpError("invalid_start_date", "A data de inicio do aluno e obrigatoria.", 400);
  }

  return {
    fullName,
    email,
    phone: normalizeOptionalPhone(payload.phone),
    birthDate: normalizeOptionalString(payload.birthDate),
    goal: normalizeOptionalString(payload.goal) ?? "",
    notes: normalizeOptionalString(payload.notes),
    startDate,
  };
}

async function createStudentWithTemporaryPassword(
  request: Request,
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  teacherId: string,
  payload: Record<string, unknown>,
) {
  const input = normalizeCreateStudentPayload(payload);
  await assertTeacherCanAddStudent(serviceRoleClient, teacherId);

  const temporaryPassword = generateTemporaryPassword();
  const generatedAt = nowIso();
  const accessLink = buildStudentAccessLink(request, input.email);
  let authUserId: string | null = null;
  let studentId: string | null = null;

  const { data: createdAuthUser, error: createAuthError } = await serviceRoleClient.auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: buildStudentAuthMetadata({
      teacherId,
      studentId: null,
      fullName: input.fullName,
    }),
  });

  if (createAuthError || !createdAuthUser.user) {
    const message = createAuthError?.message ?? "Nao foi possivel criar a conta de autenticacao do aluno.";
    const code = /already registered|already been registered|already exists/i.test(message) ? "student_email_in_use" : "student_auth_create_failed";
    throw new EdgeHttpError(code, message, code === "student_email_in_use" ? 409 : 400);
  }

  authUserId = createdAuthUser.user.id;

  try {
    const { data: insertedStudent, error: insertStudentError } = await serviceRoleClient
      .from("students")
      .insert({
        teacher_id: teacherId,
        auth_user_id: authUserId,
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        birth_date: input.birthDate,
        goal: input.goal,
        notes: input.notes,
        access_status: "temporary_password_pending",
        must_change_password: true,
        status: "active",
        temporary_password_generated_at: generatedAt,
        first_access_completed_at: null,
        start_date: input.startDate,
        payment_due_date: addDays(input.startDate, 30),
      })
      .select("id, full_name, email")
      .maybeSingle();

    if (insertStudentError || !insertedStudent) {
      throw new EdgeHttpError(
        "student_profile_create_failed",
        insertStudentError?.message ?? "Nao foi possivel criar o registro do aluno.",
        400,
      );
    }

    studentId = insertedStudent.id as string;

    const { error: metadataError } = await serviceRoleClient.auth.admin.updateUserById(authUserId, {
      user_metadata: buildStudentAuthMetadata({
        teacherId,
        studentId,
        fullName: input.fullName,
      }),
    });

    if (metadataError) {
      throw new EdgeHttpError("student_auth_metadata_failed", metadataError.message, 400);
    }

    const { error: workoutPlanError } = await serviceRoleClient.rpc("ensure_student_workout_plan", {
      p_teacher_id: teacherId,
      p_student_id: studentId,
      p_start_date: input.startDate,
      p_next_workout_change_date: null,
    });

    if (workoutPlanError) {
      throw new EdgeHttpError("student_workout_plan_failed", workoutPlanError.message, 400);
    }

    const emailDelivery = await sendStudentTemporaryAccessEmail({
      studentName: insertedStudent.full_name as string,
      email: insertedStudent.email as string,
      accessLink,
      temporaryPassword,
    });

    return {
      studentId,
      studentName: insertedStudent.full_name as string,
      email: insertedStudent.email as string,
      phone: input.phone,
      temporaryPassword,
      generatedAt,
      accessLink,
      emailDelivery,
    };
  } catch (error) {
    await deleteStudentBestEffort(serviceRoleClient, studentId);
    await deleteAuthUserBestEffort(serviceRoleClient, authUserId);
    throw error;
  }
}

async function resetStudentTemporaryAccess(
  request: Request,
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  teacherId: string,
  payload: Record<string, unknown>,
) {
  const studentId = String(payload.studentId ?? "").trim();
  if (!studentId) {
    throw new EdgeHttpError("invalid_student_id", "studentId e obrigatorio.", 400);
  }

  const { data: student, error: studentError } = await serviceRoleClient
    .from("students")
    .select("id, teacher_id, auth_user_id, full_name, email, phone")
    .eq("id", studentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (studentError || !student) {
    throw new EdgeHttpError("student_not_found", "Aluno nao encontrado.", 404, {
      reason: studentError?.message ?? null,
      studentId,
    });
  }

  if (!student.email) {
    throw new EdgeHttpError("student_email_required", "O aluno precisa ter um e-mail valido para usar o acesso temporario.", 422);
  }

  const temporaryPassword = generateTemporaryPassword();
  const generatedAt = nowIso();
  const accessLink = buildStudentAccessLink(request, String(student.email));
  let authUserId = (student.auth_user_id as string | null) ?? null;

  if (authUserId) {
    const { error } = await serviceRoleClient.auth.admin.updateUserById(authUserId, {
      email: String(student.email),
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: buildStudentAuthMetadata({
        teacherId,
        studentId: student.id as string,
        fullName: String(student.full_name),
      }),
    });

    if (error) {
      throw new EdgeHttpError("student_auth_update_failed", error.message, 400);
    }
  } else {
    const { data, error } = await serviceRoleClient.auth.admin.createUser({
      email: String(student.email),
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: buildStudentAuthMetadata({
        teacherId,
        studentId: student.id as string,
        fullName: String(student.full_name),
      }),
    });

    if (error || !data.user) {
      const message = error?.message ?? "Nao foi possivel criar a conta do aluno.";
      const code = /already registered|already been registered|already exists/i.test(message) ? "student_email_in_use" : "student_auth_create_failed";
      throw new EdgeHttpError(code, message, code === "student_email_in_use" ? 409 : 400);
    }

    authUserId = data.user.id;
  }

  const { error: updateStudentError } = await serviceRoleClient
    .from("students")
    .update({
      auth_user_id: authUserId,
      access_status: "temporary_password_pending",
      must_change_password: true,
      status: "active",
      temporary_password_generated_at: generatedAt,
      first_access_completed_at: null,
    })
    .eq("id", student.id)
    .eq("teacher_id", teacherId);

  if (updateStudentError) {
    throw new EdgeHttpError("student_access_update_failed", updateStudentError.message, 400);
  }

  const emailDelivery = await sendStudentTemporaryAccessEmail({
    studentName: String(student.full_name),
    email: String(student.email),
    accessLink,
    temporaryPassword,
  });

  return {
    studentId: student.id as string,
    studentName: String(student.full_name),
    email: String(student.email),
    phone: normalizeOptionalPhone(student.phone),
    temporaryPassword,
    generatedAt,
    accessLink,
    emailDelivery,
  };
}

async function setStudentStatus(
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  teacherId: string,
  payload: Record<string, unknown>,
) {
  const studentId = String(payload.studentId ?? "").trim();
  const active = Boolean(payload.active);

  if (!studentId) {
    throw new EdgeHttpError("invalid_student_id", "studentId e obrigatorio.", 400);
  }

  const { data: student, error: studentLookupError } = await serviceRoleClient
    .from("students")
    .select("id, auth_user_id, must_change_password")
    .eq("id", studentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (studentLookupError || !student) {
    throw new EdgeHttpError("student_not_found", "Aluno nao encontrado.", 404, {
      reason: studentLookupError?.message ?? null,
      studentId,
    });
  }

  const status = active ? "active" : "inactive";
  const accessStatus = active
    ? student.auth_user_id
      ? student.must_change_password
        ? "temporary_password_pending"
        : "active"
      : "inactive"
    : "inactive";

  const { data, error } = await serviceRoleClient
    .from("students")
    .update({
      status,
      access_status: accessStatus,
    })
    .eq("id", studentId)
    .eq("teacher_id", teacherId)
    .select("id,status,access_status")
    .maybeSingle();

  if (error || !data) {
    throw new EdgeHttpError("student_status_update_failed", error?.message ?? "Nao foi possivel atualizar o status do aluno.", 400);
  }

  return data;
}

async function markPaymentReceived(
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  teacherId: string,
  payload: Record<string, unknown>,
) {
  const studentId = String(payload.studentId ?? "").trim();
  const paidAt = String(payload.paidAt ?? new Date().toISOString().slice(0, 10));
  if (!studentId) {
    throw new EdgeHttpError("invalid_student_id", "studentId e obrigatorio.", 400);
  }

  const nextDueDate = new Date(`${paidAt}T00:00:00.000Z`);
  nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 30);

  const { data, error } = await serviceRoleClient
    .from("students")
    .update({
      payment_last_paid_at: paidAt,
      payment_due_date: nextDueDate.toISOString().slice(0, 10),
      proof_of_payment_status: "approved",
    })
    .eq("id", studentId)
    .eq("teacher_id", teacherId)
    .select("id,payment_last_paid_at,payment_due_date,proof_of_payment_status")
    .maybeSingle();

  if (error || !data) {
    throw new EdgeHttpError("student_payment_update_failed", error?.message ?? "Nao foi possivel registrar o pagamento.", 400);
  }

  return data;
}

async function approvePaymentProof(
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  teacherId: string,
  payload: Record<string, unknown>,
) {
  return markPaymentReceived(serviceRoleClient, teacherId, payload);
}

async function activateCoachProPlan(
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  teacherId: string,
) {
  const { data, error } = await serviceRoleClient.rpc("confirm_mock_pro_payment", {
    p_teacher_id: teacherId,
  });

  if (error) {
    throw new EdgeHttpError("activate_coach_pro_plan_failed", error.message, 400, error.details);
  }

  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return createOptionsResponse();
  }

  const requestId = getRequestId(request);

  try {
    ensureMethod(request, ["POST"]);
    const actor = await requireCoachUser(request);
    const body = await parseJsonBody<TeacherAdminActionRequest>(request);
    const serviceRoleClient = createServiceRoleClient();
    const teacherId = await requireTeacherId(serviceRoleClient, actor.user.id);

    if (!body.action || !supportedActions.has(body.action)) {
      throw new EdgeHttpError("unsupported_action", "Acao administrativa nao suportada por esta funcao.", 400, {
        supportedActions: Array.from(supportedActions),
      });
    }

    let data: unknown;

    switch (body.action) {
      case "create_student_with_temporary_password":
        data = await createStudentWithTemporaryPassword(request, serviceRoleClient, teacherId, body.payload);
        break;
      case "reset_student_temporary_access":
        data = await resetStudentTemporaryAccess(request, serviceRoleClient, teacherId, body.payload);
        break;
      case "set_student_status":
        data = await setStudentStatus(serviceRoleClient, teacherId, body.payload);
        break;
      case "mark_payment_received":
        data = await markPaymentReceived(serviceRoleClient, teacherId, body.payload);
        break;
      case "approve_payment_proof":
        data = await approvePaymentProof(serviceRoleClient, teacherId, body.payload);
        break;
      case "activate_coach_pro_plan":
        data = await activateCoachProPlan(serviceRoleClient, teacherId);
        break;
    }

    return createSuccessResponse(requestId, {
      actorUserId: actor.user.id,
      actorRole: actor.profile?.role ?? null,
      teacherId,
      action: body.action,
      result: data,
    });
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
