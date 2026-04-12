import { store } from "@/lib/store";
import { forgotPasswordSchema, formatCpf, isValidCpf, loginSchema, normalizeCpf, normalizeEmail, normalizePhone, registerSchema, resetPasswordSchema, sanitizeName, updateProfileSchema } from "@/lib/auth-validators";
import { loadPersistedProfileImage, persistProfileImageFile, removePersistedProfileImage } from "@/lib/profile-media";
import { buildAuthCallbackUrl } from "@/lib/supabase/auth-redirects";
import { getSupabaseClient, hasSupabaseConfig, resetSupabaseClient } from "@/lib/supabase/client";
import { fetchTeacherAccessStatus, registerTeacherWithTrial } from "@/lib/supabase/teacher-plans";
import type { AuthSession, AuthUser, CompleteFirstAccessInput, ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput, UpdateProfileInput } from "@/types/auth";
import type { StudentTemporaryAccess } from "@/types";

type StoredAuthUser = Omit<AuthUser, "avatarUrl"> & {
  passwordHash: string;
  passwordSalt: string;
};

type ResetTokenRecord = {
  tokenHash: string;
  userId?: string | null;
  email: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
};

type RateLimitRecord = {
  timestamps: string[];
};

type AuthDatabase = {
  users: StoredAuthUser[];
  session: AuthSession | null;
  resetTokens: ResetTokenRecord[];
  rateLimits: Record<string, RateLimitRecord>;
};

const AUTH_STORAGE_KEY = "sano-plus-auth";
const LOGIN_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const TEMPORARY_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

export class AuthServiceError extends Error {
  code: string;
  field?: string;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function clearSupabaseBrowserSession() {
  if (typeof window === "undefined") return;

  const clearStorage = (storage: Storage) => {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;

      if (key.startsWith("sb-") || key.includes("supabase")) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => storage.removeItem(key));
  };

  clearStorage(window.localStorage);

  if (typeof window.sessionStorage !== "undefined") {
    clearStorage(window.sessionStorage);
  }
}

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function sha256(value: string) {
  const encoder = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string) {
  return sha256(`${salt}:${password}`);
}

async function verifyPassword(password: string, salt: string, expectedHash: string) {
  return (await hashPassword(password, salt)) === expectedHash;
}

function defaultDb(): AuthDatabase {
  return {
    users: [],
    session: null,
    resetTokens: [],
    rateLimits: {},
  };
}

function normalizeStoredUser(user: any): StoredAuthUser {
  return {
    id: user.id,
    role: user.role ?? "coach",
    linkedStudentId: user.linkedStudentId ?? null,
    accountStatus: user.accountStatus ?? "active",
    mustChangePassword: user.mustChangePassword ?? false,
    temporaryPasswordGeneratedAt: user.temporaryPasswordGeneratedAt ?? null,
    firstAccessCompletedAt: user.firstAccessCompletedAt ?? null,
    fullName: user.fullName ?? "",
    birthDate: user.birthDate ?? "",
    cpf: user.cpf ?? null,
    email: normalizeEmail(user.email ?? ""),
    phone: user.phone ?? null,
    notes: user.notes ?? null,
    avatarStorageKey: user.avatarStorageKey ?? null,
    createdAt: user.createdAt ?? nowIso(),
    updatedAt: user.updatedAt ?? nowIso(),
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    passwordSalt: user.passwordSalt,
    passwordHash: user.passwordHash,
  };
}

function readDb(): AuthDatabase {
  if (!canUseStorage()) return defaultDb();

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      const db = defaultDb();
      writeDb(db);
      return db;
    }

    const parsed = JSON.parse(raw) as Partial<AuthDatabase>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users.map(normalizeStoredUser) : [],
      session: parsed.session ?? null,
      resetTokens: Array.isArray(parsed.resetTokens) ? parsed.resetTokens : [],
      rateLimits: parsed.rateLimits ?? {},
    };
  } catch {
    const db = defaultDb();
    writeDb(db);
    return db;
  }
}

function writeDb(db: AuthDatabase) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(db));
}

function clearLegacyAuthSessionState() {
  const db = readDb();
  db.session = null;
  writeDb(db);
}

function cleanRateLimit(record?: RateLimitRecord) {
  const now = Date.now();
  return (record?.timestamps ?? []).filter((value) => now - new Date(value).getTime() <= LOGIN_LIMIT_WINDOW_MS);
}

function touchRateLimit(db: AuthDatabase, key: string) {
  const timestamps = [...cleanRateLimit(db.rateLimits[key]), nowIso()];
  db.rateLimits[key] = { timestamps };
}

function ensureWithinRateLimit(db: AuthDatabase, key: string) {
  const timestamps = cleanRateLimit(db.rateLimits[key]);
  db.rateLimits[key] = { timestamps };

  if (timestamps.length >= LOGIN_LIMIT_ATTEMPTS) {
    throw new AuthServiceError("rate_limited", "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.");
  }
}

function stripUserSecrets(user: StoredAuthUser, avatarUrl?: string | null): AuthUser {
  const { passwordHash, passwordSalt, ...publicUser } = user;
  return { ...publicUser, avatarUrl: avatarUrl ?? null };
}

async function resolveUserAvatar(user: StoredAuthUser) {
  return user.avatarStorageKey ? await loadPersistedProfileImage(user.avatarStorageKey).catch(() => null) : null;
}

async function resolveUser(user?: StoredAuthUser | null) {
  if (!user) return null;
  const avatarUrl = await resolveUserAvatar(user);
  return stripUserSecrets(user, avatarUrl);
}

function generateResetToken() {
  return `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

async function buildResetRecord(email: string, userId?: string | null): Promise<{ token: string; record: ResetTokenRecord }> {
  const token = generateResetToken();
  const tokenHash = await sha256(token);
  const createdAt = nowIso();

  return {
    token,
    record: {
      tokenHash,
      userId,
      email,
      createdAt,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
      usedAt: null,
    },
  };
}

function ensureStudentCanAuthenticate(user: StoredAuthUser) {
  if (user.role !== "student") return;
  if (user.accountStatus !== "active") {
    throw new AuthServiceError("inactive_account", "Seu acesso foi desativado. Fale com seu professor.");
  }

  const student = store.getStudentByUserId(user.id);
  if (!student || student.studentStatus !== "active") {
    throw new AuthServiceError("inactive_account", "Seu acesso foi desativado. Fale com seu professor.");
  }

  if (!["temporary_password_pending", "active"].includes(student.accessStatus)) {
    throw new AuthServiceError("inactive_account", "Seu acesso nao esta liberado no momento.");
  }

  if (
    user.mustChangePassword &&
    user.temporaryPasswordGeneratedAt &&
    Date.now() - new Date(user.temporaryPasswordGeneratedAt).getTime() > TEMPORARY_PASSWORD_TTL_MS
  ) {
    throw new AuthServiceError("temporary_password_expired", "Sua senha provisoria expirou. Solicite uma nova ao professor.");
  }
}

function ensureStudentCanUseApp(user: StoredAuthUser) {
  ensureStudentCanAuthenticate(user);
  if (user.mustChangePassword) {
    throw new AuthServiceError("first_access_required", "Defina uma nova senha para continuar.");
  }
}

function isSupabaseEnabled() {
  return hasSupabaseConfig();
}

function isRecoveryFlowContext() {
  if (typeof window === "undefined") return false;

  const pathname = window.location.pathname;
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const hashType = hashParams.get("type");
  const nextPath = searchParams.get("next") ?? "";

  return (
    pathname === "/redefinir-senha" ||
    pathname === "/reset-password" ||
    pathname === "/update-password" ||
    (pathname === "/auth/callback" && (hashType === "recovery" || nextPath.includes("redefinir-senha")))
  );
}

function mapSupabaseCoachUser(params: {
  authUserId: string;
  email: string;
  fullName: string;
  birthDate: string;
  cpf?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  teacherId?: string | null;
  teacherPlanType?: AuthUser["teacherPlanType"];
  teacherSubscriptionStatus?: AuthUser["teacherSubscriptionStatus"];
  teacherTrialEndsAt?: string | null;
  teacherHasActiveAccess?: boolean | null;
  teacherCanAddStudent?: boolean | null;
  teacherAccessMessage?: string | null;
}): AuthUser {
  return {
    id: params.authUserId,
    role: "coach",
    linkedStudentId: null,
    accountStatus: "active",
    mustChangePassword: false,
    fullName: params.fullName,
    birthDate: params.birthDate,
    cpf: params.cpf ?? null,
    email: normalizeEmail(params.email),
    phone: params.phone ?? null,
    notes: null,
    avatarStorageKey: null,
    avatarUrl: params.avatarUrl ?? null,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    emailVerifiedAt: null,
    teacherId: params.teacherId ?? null,
    teacherPlanType: params.teacherPlanType ?? null,
    teacherSubscriptionStatus: params.teacherSubscriptionStatus ?? null,
    teacherTrialEndsAt: params.teacherTrialEndsAt ?? null,
    teacherHasActiveAccess: params.teacherHasActiveAccess ?? null,
    teacherCanAddStudent: params.teacherCanAddStudent ?? null,
    teacherAccessMessage: params.teacherAccessMessage ?? null,
  };
}

async function resolveSupabaseCoachUser() {
  if (!isSupabaseEnabled()) return null;

  const supabase = getSupabaseClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, email, full_name, birth_date, cpf, phone, avatar_url, metadata, created_at, updated_at")
    .eq("user_id", authUser.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  let accessSnapshot: Awaited<ReturnType<typeof fetchTeacherAccessStatus>>["access"] | null = null;
  try {
    const accessData = await fetchTeacherAccessStatus();
    accessSnapshot = accessData.access;
  } catch {
    accessSnapshot = null;
  }

  let teacherId = accessSnapshot?.teacher_id ?? null;
  if (!teacherId) {
    const { data: teacherRecord } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", authUser.id)
      .single();

    teacherId = teacherRecord?.id ?? null;
  }

  const selectedPlanFromProfile =
    profile.metadata && typeof profile.metadata === "object" && "selected_plan" in profile.metadata
      ? profile.metadata.selected_plan
      : null;
  const selectedPlanFromAuth = authUser.user_metadata?.selected_plan ?? null;
  const fallbackPlanType =
    accessSnapshot?.plan_type ??
    (selectedPlanFromProfile === "basic" || selectedPlanFromProfile === "pro" ? selectedPlanFromProfile : null) ??
    (selectedPlanFromAuth === "basic" || selectedPlanFromAuth === "pro" ? selectedPlanFromAuth : null);

  return mapSupabaseCoachUser({
    authUserId: profile.user_id,
    email: profile.email,
    fullName: profile.full_name,
    birthDate: profile.birth_date,
    cpf: profile.cpf,
    phone: profile.phone,
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    teacherId,
    teacherPlanType: fallbackPlanType ?? null,
    teacherSubscriptionStatus: accessSnapshot?.effective_status ?? null,
    teacherTrialEndsAt: accessSnapshot?.trial_ends_at ?? null,
    teacherHasActiveAccess: accessSnapshot?.has_active_access ?? null,
    teacherCanAddStudent: accessSnapshot?.can_add_student ?? null,
    teacherAccessMessage: accessSnapshot?.access_message ?? null,
  });
}

async function resolveSupabaseStudentUser() {
  if (!isSupabaseEnabled()) return null;

  const supabase = getSupabaseClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  const { data: studentRows, error: studentError } = await supabase
    .from("students")
    .select(`
      id,
      teacher_id,
      auth_user_id,
      full_name,
      birth_date,
      email,
      phone,
      notes,
      status,
      access_status,
      temporary_password_generated_at,
      first_access_completed_at,
      created_at,
      updated_at
    `)
    .eq("auth_user_id", authUser.id)
    .limit(1);

  if (studentError) {
    return null;
  }

  const student = (studentRows ?? [])[0];
  if (!student) {
    return null;
  }

  return {
    id: authUser.id,
    role: "student" as const,
    linkedStudentId: student.id,
    accountStatus: student.status === "inactive" ? "inactive" : "active",
    mustChangePassword: student.access_status === "temporary_password_pending",
    temporaryPasswordGeneratedAt: student.temporary_password_generated_at ?? null,
    firstAccessCompletedAt: student.first_access_completed_at ?? null,
    fullName: student.full_name,
    birthDate: student.birth_date ?? "",
    cpf: null,
    email: normalizeEmail(student.email ?? authUser.email ?? ""),
    phone: student.phone ?? null,
    notes: student.notes ?? null,
    avatarStorageKey: null,
    avatarUrl: null,
    createdAt: student.created_at,
    updatedAt: student.updated_at,
    emailVerifiedAt: null,
  } satisfies AuthUser;
}

async function resolveSupabaseAppUser() {
  const coachUser = await resolveSupabaseCoachUser();
  if (coachUser) return coachUser;

  return resolveSupabaseStudentUser();
}

function isSupabaseAuthError(message?: string) {
  if (!message) return false;
  return /invalid login credentials|email not confirmed|user already registered|invalid/i.test(message);
}

function mapSupabasePasswordRecoveryError(message?: string, field: "email" | "password" = "email") {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (normalizedMessage.includes("email rate limit exceeded")) {
    return new AuthServiceError(
      "password_reset_rate_limited",
      "Voce solicitou muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
      field,
    );
  }

  if (normalizedMessage.includes("for security purposes")) {
    return new AuthServiceError(
      "password_reset_rate_limited",
      "Voce solicitou muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
      field,
    );
  }

  if (normalizedMessage.includes("same_password")) {
    return new AuthServiceError(
      "same_password",
      "Escolha uma senha diferente da senha atual.",
      field,
    );
  }

  if (normalizedMessage.includes("auth session missing") || normalizedMessage.includes("session missing")) {
    return new AuthServiceError(
      "invalid_reset_token",
      "O link de redefinicao e invalido, expirou ou ja foi utilizado. Solicite um novo link.",
      field,
    );
  }

  if (normalizedMessage.includes("expired") || normalizedMessage.includes("invalid token")) {
    return new AuthServiceError(
      "invalid_reset_token",
      "O link de redefinicao e invalido, expirou ou ja foi utilizado. Solicite um novo link.",
      field,
    );
  }

  return new AuthServiceError(
    field === "password" ? "password_reset_failed" : "password_reset_request_failed",
    field === "password"
      ? "Nao foi possivel salvar sua nova senha agora. Tente novamente."
      : "Nao foi possivel enviar o e-mail de redefinicao agora. Tente novamente.",
    field,
  );
}

function shouldTreatPasswordResetRequestAsSoftSuccess(message?: string) {
  const normalizedMessage = message?.toLowerCase() ?? "";

  return (
    normalizedMessage.includes("email rate limit exceeded") ||
    normalizedMessage.includes("for security purposes")
  );
}

async function tryProvisionSupabaseCoachFromMetadata() {
  if (!isSupabaseEnabled()) return;

  const supabase = getSupabaseClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return;

  const metadata = authUser.user_metadata ?? {};
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  const birthDate = typeof metadata.birth_date === "string" ? metadata.birth_date.trim() : "";
  const cpf = typeof metadata.cpf === "string" ? metadata.cpf.trim() : "";
  const phone = typeof metadata.phone === "string" ? metadata.phone.trim() : null;
  const selectedPlan = metadata.selected_plan === "pro" ? "pro" : metadata.selected_plan === "basic" ? "basic" : null;
  const mockProPaymentConfirmed = Boolean(metadata.mock_pro_payment_confirmed);

  if (!fullName || !birthDate || !cpf || !selectedPlan) {
    return;
  }

  await supabase.functions.invoke("create-teacher-account", {
    body: {
      fullName,
      birthDate,
      cpf,
      phone,
      selectedPlan,
      mockProPaymentConfirmed,
      metadata: {
        source: "auth_metadata_bootstrap",
      },
    },
  }).catch(() => undefined);
}

export const authService = {
  async getCurrentUser() {
    if (isSupabaseEnabled() && !isRecoveryFlowContext()) {
      await tryProvisionSupabaseCoachFromMetadata();
    }

    const supabaseUser = await resolveSupabaseAppUser();
    if (supabaseUser) {
      clearLegacyAuthSessionState();
      if (supabaseUser.role === "student" && supabaseUser.accountStatus !== "active") {
        await getSupabaseClient().auth.signOut({ scope: "local" }).catch(() => undefined);
        return null;
      }

      return supabaseUser;
    }

    if (isSupabaseEnabled()) {
      const {
        data: { user: authUser },
      } = await getSupabaseClient().auth.getUser().catch(() => ({ data: { user: null } }));

      if (authUser) {
        if (isRecoveryFlowContext()) {
          return null;
        }

        await getSupabaseClient().auth.signOut({ scope: "local" }).catch(() => undefined);
        clearSupabaseBrowserSession();
      }

      return null;
    }

    const db = readDb();
    if (!db.session?.userId) return null;
    const user = db.users.find((item) => item.id === db.session?.userId);
    if (user) {
      try {
        if (user.role === "student") {
          ensureStudentCanAuthenticate(user);
        }
      } catch {
        db.session = null;
        writeDb(db);
        return null;
      }
    }
    return resolveUser(user);
  },

  async register(input: RegisterInput) {
    if (isSupabaseEnabled()) {
      const parsed = registerSchema.safeParse({
        fullName: input.fullName,
        birthDate: input.birthDate,
        cpf: input.cpf,
        email: input.email,
        password: input.password,
        confirmPassword: input.password,
      });

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
      }

      if (!input.selectedPlan) {
        throw new AuthServiceError("plan_required", "Escolha um plano para continuar.", "selectedPlan");
      }

      if (input.selectedPlan === "pro" && !input.mockProPaymentConfirmed) {
        throw new AuthServiceError("mock_payment_confirmation_required", "Confirme a assinatura simulada do plano Pro para continuar.", "mockProPaymentConfirmed");
      }

      try {
        const registrationResult = await registerTeacherWithTrial({
          email: parsed.data.email,
          password: parsed.data.password,
          fullName: parsed.data.fullName,
          birthDate: parsed.data.birthDate,
          cpf: parsed.data.cpf,
          selectedPlan: input.selectedPlan,
          mockProPaymentConfirmed: Boolean(input.mockProPaymentConfirmed),
        });

        if ("requiresEmailConfirmation" in registrationResult) {
          clearLegacyAuthSessionState();
          return null;
        }

        clearLegacyAuthSessionState();
      } catch (error) {
        await getSupabaseClient().auth.signOut({ scope: "local" }).catch(() => undefined);
        const message = error instanceof Error ? error.message : "Nao foi possivel criar sua conta agora. Tente novamente.";
        if (/already registered|ja esta em uso/i.test(message)) {
          throw new AuthServiceError("email_in_use", "Este e-mail ja esta em uso.", "email");
        }
        if (/cpf invalido/i.test(message)) {
          throw new AuthServiceError("validation_error", "Informe um CPF valido.", "cpf");
        }
        throw new AuthServiceError("register_failed", message);
      }

      const currentUser = await resolveSupabaseAppUser();
      if (!currentUser) {
        return null;
      }

      return currentUser;
    }

    const db = readDb();
    const parsed = registerSchema.safeParse({
      fullName: input.fullName,
      birthDate: input.birthDate,
      cpf: input.cpf,
      email: input.email,
      password: input.password,
      confirmPassword: input.password,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
    }

    const email = normalizeEmail(input.email);
    const cpf = normalizeCpf(input.cpf);

    if (db.users.some((user) => user.email === email)) {
      throw new AuthServiceError("email_in_use", "Este e-mail ja esta em uso.", "email");
    }

    if (cpf && db.users.some((user) => user.cpf && user.cpf === cpf)) {
      throw new AuthServiceError("cpf_in_use", "Este CPF ja esta cadastrado.", "cpf");
    }

    let avatarStorageKey: string | null = null;
    if (input.avatarFile) {
      avatarStorageKey = await persistProfileImageFile(input.avatarFile);
    }

    const createdAt = nowIso();
    const passwordSalt = createId();
    const passwordHash = await hashPassword(input.password, passwordSalt);

    const user: StoredAuthUser = {
      id: createId(),
      role: "coach",
      linkedStudentId: null,
      accountStatus: "active",
      mustChangePassword: false,
      temporaryPasswordGeneratedAt: null,
      firstAccessCompletedAt: createdAt,
      fullName: sanitizeName(input.fullName),
      birthDate: input.birthDate,
      cpf,
      email,
      phone: null,
      notes: null,
      avatarStorageKey,
      createdAt,
      updatedAt: createdAt,
      emailVerifiedAt: null,
      passwordSalt,
      passwordHash,
    };

    db.users.unshift(user);
    db.session = { userId: user.id, createdAt, lastActiveAt: createdAt };
    writeDb(db);

    return resolveUser(user);
  },

  async issueStudentTemporaryAccess(studentId: string): Promise<StudentTemporaryAccess> {
    if (isSupabaseEnabled()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke("issue-student-temporary-access", {
        body: { studentId },
      });

      if (error || !data) {
        throw new AuthServiceError("student_access_issue_failed", error?.message ?? "Nao foi possivel gerar o acesso do aluno.");
      }

      return data as StudentTemporaryAccess;
    }

    const db = readDb();
    const student = store.getStudent(studentId);
    if (!student) {
      throw new AuthServiceError("student_not_found", "Aluno nao encontrado.");
    }

    const normalizedEmail = normalizeEmail(student.email);
    const conflictingCoach = db.users.find((user) => user.email === normalizedEmail && user.role === "coach");
    if (conflictingCoach) {
      throw new AuthServiceError("email_in_use", "Este e-mail ja esta em uso por outra conta.");
    }

    const currentUser = db.users.find((user) => user.role === "student" && user.linkedStudentId === studentId);
    const generatedAt = nowIso();
    const temporaryPassword = generateTemporaryPassword();
    const passwordSalt = createId();
    const passwordHash = await hashPassword(temporaryPassword, passwordSalt);

    const nextUser: StoredAuthUser = {
      id: currentUser?.id ?? createId(),
      role: "student",
      linkedStudentId: studentId,
      accountStatus: "active",
      mustChangePassword: true,
      temporaryPasswordGeneratedAt: generatedAt,
      firstAccessCompletedAt: null,
      fullName: student.fullName,
      birthDate: student.birthDate,
      cpf: currentUser?.cpf ?? null,
      email: normalizedEmail,
      phone: student.phone || null,
      notes: student.notes || null,
      avatarStorageKey: currentUser?.avatarStorageKey ?? student.profilePhotoStorageKey ?? null,
      createdAt: currentUser?.createdAt ?? generatedAt,
      updatedAt: generatedAt,
      emailVerifiedAt: currentUser?.emailVerifiedAt ?? null,
      passwordSalt,
      passwordHash,
    };

    db.users = db.users.filter((user) => user.id !== nextUser.id);
    db.users.unshift(nextUser);
    writeDb(db);
    store.provisionStudentAccess(studentId, nextUser.id, generatedAt);

    return {
      studentId,
      studentName: student.fullName,
      email: normalizedEmail,
      temporaryPassword,
      generatedAt,
    };
  },

  async login(input: LoginInput) {
    if (isSupabaseEnabled()) {
      const parsed = loginSchema.safeParse(input);

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
      }

      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (!error) {
          clearLegacyAuthSessionState();
          await tryProvisionSupabaseCoachFromMetadata().catch(() => undefined);
          const currentUser = await resolveSupabaseAppUser();
          if (currentUser?.role === "student") {
            if (currentUser.accountStatus !== "active") {
              await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
              throw new AuthServiceError("inactive_account", "Seu acesso foi desativado. Fale com seu professor.");
            }

            if (currentUser.linkedStudentId) {
              try { await supabase.rpc("touch_student_last_login", { p_student_id: currentUser.linkedStudentId }); } catch {}
            }
          }

          if (currentUser) return currentUser;

          let profileRows: any[] | null = null;
          try {
            const res = await supabase.from("profiles").select("user_id").eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "").limit(1);
            profileRows = res.data;
          } catch {}

          if (profileRows && profileRows.length > 0) {
            await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
            throw new AuthServiceError(
              "account_not_linked",
              "Sua conta existe, mas ainda nao terminou de ser vinculada ao workspace. Tente entrar novamente em alguns instantes.",
            );
          }

          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          throw new AuthServiceError("account_not_linked", "Sua conta nao esta vinculada a um perfil ativo no sistema.");
        }

        const normalizedMessage = error.message.toLowerCase();
        if (normalizedMessage.includes("invalid login credentials")) {
          throw new AuthServiceError("invalid_credentials", "E-mail ou senha invalidos.");
        }

        if (normalizedMessage.includes("email not confirmed")) {
          throw new AuthServiceError("email_not_confirmed", "Confirme seu e-mail para concluir o acesso.");
        }

        if (isSupabaseAuthError(error.message)) {
          throw new AuthServiceError("login_failed", error.message);
        }

        throw new AuthServiceError("login_failed", error.message);
      } catch (error) {
        if (error instanceof AuthServiceError) {
          throw error;
        }

        throw new AuthServiceError("login_failed", "Nao foi possivel entrar agora. Tente novamente.");
      }
    }

    const db = readDb();
    const parsed = loginSchema.safeParse(input);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
    }

    const email = normalizeEmail(input.email);
    const rateKey = `login:${email}`;
    ensureWithinRateLimit(db, rateKey);

    const user = db.users.find((item) => item.email === email);
    const valid = user ? await verifyPassword(input.password, user.passwordSalt, user.passwordHash) : false;

    if (!user || !valid) {
      touchRateLimit(db, rateKey);
      writeDb(db);
      throw new AuthServiceError("invalid_credentials", "E-mail ou senha invalidos.");
    }

    if (user.role === "student") {
      ensureStudentCanAuthenticate(user);
    }

    db.rateLimits[rateKey] = { timestamps: [] };
    db.session = {
      userId: user.id,
      createdAt: db.session?.userId === user.id ? db.session.createdAt : nowIso(),
      lastActiveAt: nowIso(),
    };
    writeDb(db);

    if (user.role === "student" && user.linkedStudentId) {
      store.markStudentLastLogin(user.linkedStudentId);
    }

    return resolveUser(user);
  },

  async completeFirstAccess(input: CompleteFirstAccessInput) {
    if (isSupabaseEnabled()) {
      const currentUser = await resolveSupabaseAppUser();
      if (!currentUser || currentUser.role !== "student" || !currentUser.mustChangePassword || !currentUser.linkedStudentId) {
        throw new AuthServiceError("invalid_state", "Nao ha troca obrigatoria pendente para esta conta.");
      }

      const parsed = resetPasswordSchema.safeParse({
        password: input.password,
        confirmPassword: input.password,
      });

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: input.password });
      if (error) {
        throw new AuthServiceError("first_access_failed", error.message, "password");
      }

      clearLegacyAuthSessionState();
      await supabase.rpc("mark_student_first_access_complete", {
        p_student_id: currentUser.linkedStudentId,
      }).throwOnError();

      try { await supabase.rpc("touch_student_last_login", { p_student_id: currentUser.linkedStudentId }); } catch {}

      return resolveSupabaseAppUser();
    }

    const db = readDb();
    if (!db.session?.userId) {
      throw new AuthServiceError("unauthorized", "Sua sessao expirou. Entre novamente.");
    }

    const user = db.users.find((item) => item.id === db.session?.userId);
    if (!user || user.role !== "student" || !user.mustChangePassword) {
      throw new AuthServiceError("invalid_state", "Nao ha troca obrigatoria pendente para esta conta.");
    }

    const parsed = resetPasswordSchema.safeParse({
      password: input.password,
      confirmPassword: input.password,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
    }

    const isSameAsTemporary = await verifyPassword(input.password, user.passwordSalt, user.passwordHash);
    if (isSameAsTemporary) {
      throw new AuthServiceError("temporary_password_reuse", "Escolha uma senha diferente da senha provisoria.", "password");
    }

    const completedAt = nowIso();
    user.passwordSalt = createId();
    user.passwordHash = await hashPassword(input.password, user.passwordSalt);
    user.mustChangePassword = false;
    user.firstAccessCompletedAt = completedAt;
    user.updatedAt = completedAt;
    writeDb(db);

    if (user.linkedStudentId) {
      store.completeStudentFirstAccess(user.linkedStudentId, completedAt);
      store.markStudentLastLogin(user.linkedStudentId);
    }

    return resolveUser(user);
  },

  async setStudentAccountStatus(studentId: string, active: boolean) {
    if (isSupabaseEnabled()) {
      return;
    }

    const db = readDb();
    db.users = db.users.map((user) =>
      user.role === "student" && user.linkedStudentId === studentId
        ? { ...user, accountStatus: active ? "active" : "inactive", updatedAt: nowIso() }
        : user,
    );
    writeDb(db);
  },

  async logout() {
    const db = readDb();
    db.session = null;
    writeDb(db);
    clearSupabaseBrowserSession();

    if (isSupabaseEnabled()) {
      const supabase = getSupabaseClient();
      await Promise.race([
        supabase.auth.signOut({ scope: "local" }).catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    }
    clearSupabaseBrowserSession();
    resetSupabaseClient();
  },

  async requestPasswordReset(input: ForgotPasswordInput) {
    if (isSupabaseEnabled()) {
      const parsed = forgotPasswordSchema.safeParse(input);

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: buildAuthCallbackUrl("/redefinir-senha"),
      });
      if (error) {
        if (shouldTreatPasswordResetRequestAsSoftSuccess(error.message)) {
          return {
            token: "",
            message: "Se existir uma conta com esse e-mail, voce recebera instrucoes para redefinir sua senha.",
          };
        }

        throw mapSupabasePasswordRecoveryError(error.message, "email");
      }

      return {
        token: "",
        message: "Se existir uma conta com esse e-mail, voce recebera instrucoes para redefinir sua senha.",
      };
    }

    const db = readDb();
    const parsed = forgotPasswordSchema.safeParse(input);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
    }

    const email = normalizeEmail(input.email);
    const rateKey = `forgot:${email}`;
    ensureWithinRateLimit(db, rateKey);
    touchRateLimit(db, rateKey);

    const user = db.users.find((item) => item.email === email);
    const { token, record } = await buildResetRecord(email, user?.id ?? null);
    db.resetTokens.unshift(record);
    writeDb(db);

    return {
      token,
      message: "Se existir uma conta com esse e-mail, voce recebera instrucoes para redefinir sua senha.",
    };
  },

  async resetPassword(input: ResetPasswordInput) {
    if (isSupabaseEnabled()) {
      const parsed = resetPasswordSchema.safeParse({
        password: input.password,
        confirmPassword: input.password,
      });

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
      }

      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new AuthServiceError(
          "invalid_reset_token",
          "O link de redefinicao e invalido, expirou ou ja foi utilizado. Solicite um novo link.",
        );
      }

      const { error } = await supabase.auth.updateUser({ password: input.password });
      if (error) {
        throw mapSupabasePasswordRecoveryError(error.message, "password");
      }

      clearLegacyAuthSessionState();
      const currentUser = await resolveSupabaseAppUser();
      return currentUser;
    }

    const db = readDb();
    const parsed = resetPasswordSchema.safeParse({
      password: input.password,
      confirmPassword: input.password,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
    }

    const tokenHash = await sha256(input.token);
    const record = db.resetTokens.find((item) => item.tokenHash === tokenHash);

    if (!record || record.usedAt || new Date(record.expiresAt).getTime() < Date.now() || !record.userId) {
      throw new AuthServiceError("invalid_reset_token", "O link de redefinicao e invalido ou expirou.");
    }

    const user = db.users.find((item) => item.id === record.userId);
    if (!user) {
      throw new AuthServiceError("invalid_reset_token", "O link de redefinicao e invalido ou expirou.");
    }

    user.passwordSalt = createId();
    user.passwordHash = await hashPassword(input.password, user.passwordSalt);
    user.mustChangePassword = false;
    user.firstAccessCompletedAt = nowIso();
    user.updatedAt = nowIso();
    record.usedAt = nowIso();
    db.session = { userId: user.id, createdAt: nowIso(), lastActiveAt: nowIso() };
    writeDb(db);

    return resolveUser(user);
  },

  async refreshSessionUser() {
    return this.getCurrentUser();
  },

  async updateProfile(input: UpdateProfileInput) {
    if (isSupabaseEnabled()) {
      const currentUser = await resolveSupabaseAppUser();
      if (currentUser?.role === "coach") {
        const parsed = updateProfileSchema.safeParse({
          fullName: input.fullName,
          birthDate: input.birthDate,
          phone: input.phone ?? "",
          notes: input.notes ?? "",
        });

        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
        }

        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: parsed.data.fullName,
            birth_date: parsed.data.birthDate,
            phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : null,
            updated_at: nowIso(),
          })
          .eq("user_id", currentUser.id);

        if (error) {
          throw new AuthServiceError("profile_update_failed", error.message);
        }

        return resolveSupabaseAppUser();
      }

      if (currentUser?.role === "student") {
        throw new AuthServiceError("profile_update_not_allowed", "O perfil do aluno nao pode ser editado por esta rota.");
      }

      return null;
    }

    const db = readDb();

    if (!db.session?.userId) {
      throw new AuthServiceError("unauthorized", "Sua sessao expirou. Entre novamente.");
    }

    const user = db.users.find((item) => item.id === db.session?.userId);
    if (!user) {
      throw new AuthServiceError("unauthorized", "Sua sessao expirou. Entre novamente.");
    }

    if (user.role === "student") {
      ensureStudentCanUseApp(user);
    }

    const parsed = updateProfileSchema.safeParse({
      fullName: input.fullName,
      birthDate: input.birthDate,
      phone: input.phone ?? "",
      notes: input.notes ?? "",
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AuthServiceError("validation_error", issue.message, String(issue.path[0] ?? "form"));
    }

    let avatarStorageKey = user.avatarStorageKey ?? null;

    if (input.removeAvatar && avatarStorageKey) {
      await removePersistedProfileImage(avatarStorageKey).catch(() => undefined);
      avatarStorageKey = null;
    }

    if (input.avatarFile) {
      avatarStorageKey = await persistProfileImageFile(input.avatarFile, avatarStorageKey);
    }

    user.fullName = parsed.data.fullName;
    user.birthDate = parsed.data.birthDate;
    user.phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
    user.notes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null;
    user.avatarStorageKey = avatarStorageKey;
    user.updatedAt = nowIso();

    writeDb(db);

    if (user.role === "student" && user.linkedStudentId) {
      await store.updateStudent(user.linkedStudentId, {
        fullName: user.fullName,
        birthDate: user.birthDate,
        phone: user.phone ?? "",
        profilePhotoStorageKey: user.avatarStorageKey ?? null,
      });
    }

    return resolveUser(user);
  },

  async updateSessionActivity() {
    const db = readDb();
    if (!db.session) return;
    db.session.lastActiveAt = nowIso();
    writeDb(db);
  },

  formatCpf,
  isValidCpf,
  normalizeCpf,
  normalizeEmail,

  async clearAllAuthData() {
    const db = readDb();
    await Promise.all(db.users.map((user) => removePersistedProfileImage(user.avatarStorageKey).catch(() => undefined)));
    if (canUseStorage()) window.localStorage.removeItem(AUTH_STORAGE_KEY);
  },
};
