import { buildAuthCallbackUrl } from "@/lib/auth-redirects";
import { normalizeEmail, normalizePhone, updateProfileSchema, validateStrongPassword } from "@/lib/auth-validators";
import { createProfilePreviewUrl, loadPersistedProfileImage, loadPersistedProfileImageBlob, persistProfileImageFile } from "@/lib/profile-media";
import { store } from "@/lib/store";
import { getSupabaseClient, hasSupabaseRuntimeConfig } from "@/integrations/supabase/client";
import { EDGE_FUNCTION_NAMES, invokeSupabaseEdgeFunction } from "@/integrations/supabase";
import { mapAuthRoleToSupabaseProfileRole, mapSupabaseProfileRoleToAuthRole } from "@/integrations/supabase/profile-mappers";
import type { User } from "@supabase/supabase-js";
import type {
  AuthSession,
  ResolvedAuthSession,
  AuthUser,
  CompleteFirstAccessInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  TeacherPlanType,
  TeacherSubscriptionStatus,
  UpdateProfileInput,
} from "@/types/auth";
import type { DatabaseUserProfile } from "@/types/profile";

const AUTH_DB_STORAGE_KEY = "sano-plus-auth-db";
const AUTH_SESSION_STORAGE_KEY = "sano-plus-auth-session";
const SUPABASE_PROFILE_AVATAR_BUCKET = "profile-avatars";

type StoredAuthUser = AuthUser & {
  password: string;
  resetPasswordToken?: string | null;
  resetPasswordIssuedAt?: string | null;
};

type AuthDatabase = {
  users: StoredAuthUser[];
};

type SupabaseProfileRow = {
  id?: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  notes?: string | null;
  role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TeacherAccessSnapshot = {
  teacher_id: string;
  subscription_id: string | null;
  plan_type: TeacherPlanType;
  stored_status: TeacherSubscriptionStatus;
  effective_status: TeacherSubscriptionStatus;
  trial_active: boolean;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  has_active_access: boolean;
  student_limit: number | null;
  current_student_count: number;
  can_add_student: boolean;
  access_message: string | null;
};

type SupabaseStudentAccessRow = {
  id: string;
  teacher_id: string;
  auth_user_id: string | null;
  must_change_password: boolean;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  notes: string | null;
  status: "active" | "inactive";
  access_status: "pre_registered" | "temporary_password_pending" | "active" | "inactive";
  temporary_password_generated_at: string | null;
  first_access_completed_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStorage<T>(key: string): T | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorage(key: string) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(key);
}

function loadDatabase(): AuthDatabase {
  const persisted = readStorage<AuthDatabase>(AUTH_DB_STORAGE_KEY);
  if (persisted?.users?.length) {
    return persisted;
  }

  return { users: [] };
}

function saveDatabase(db: AuthDatabase) {
  writeStorage(AUTH_DB_STORAGE_KEY, db);
}

function loadSession(): AuthSession | null {
  return readStorage<AuthSession>(AUTH_SESSION_STORAGE_KEY);
}

function saveSession(session: AuthSession) {
  writeStorage(AUTH_SESSION_STORAGE_KEY, session);
}

function clearSession() {
  removeStorage(AUTH_SESSION_STORAGE_KEY);
}

function mapAuthUserToProfile(user: AuthUser): DatabaseUserProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
    cpf: user.cpf ?? null,
    birthDate: user.birthDate ?? null,
    phone: user.phone ?? null,
    notes: user.notes ?? null,
    role: mapAuthRoleToSupabaseProfileRole(user.role),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapLocalSessionToResolvedSession(user: AuthUser, session: AuthSession): ResolvedAuthSession {
  return {
    userId: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    provider: "local",
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
  };
}

function stripSensitiveFields(user: StoredAuthUser): AuthUser {
  const { password: _password, resetPasswordToken: _token, resetPasswordIssuedAt: _issuedAt, ...safeUser } = user;
  return safeUser;
}

function createFallbackCoachUser(input: RegisterInput): StoredAuthUser {
  const timestamp = nowIso();
  const userId = generateId("coach");
  const subscriptionStatus: TeacherSubscriptionStatus = input.selectedPlan === "pro" ? "active" : "trialing";

  return {
    id: userId,
    role: "coach",
    linkedStudentId: null,
    accountStatus: "active",
    mustChangePassword: false,
    temporaryPasswordGeneratedAt: null,
    firstAccessCompletedAt: timestamp,
    fullName: input.fullName,
    birthDate: input.birthDate,
    cpf: input.cpf,
    email: normalizeEmail(input.email),
    phone: null,
    notes: null,
    avatarStorageKey: null,
    avatarUrl: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    emailVerifiedAt: timestamp,
    teacherId: userId,
    teacherPlanType: input.selectedPlan,
    teacherSubscriptionStatus: subscriptionStatus,
    teacherTrialEndsAt: input.selectedPlan === "basic" ? timestamp : null,
    teacherCurrentPeriodEndsAt: input.selectedPlan === "pro" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
    teacherHasActiveAccess: true,
    teacherCanAddStudent: true,
    teacherAccessMessage: null,
    password: input.password,
    resetPasswordToken: null,
    resetPasswordIssuedAt: null,
  };
}

async function syncAvatar(user: StoredAuthUser, avatarFile?: File | null, removeAvatar = false) {
  if (removeAvatar) {
    user.avatarStorageKey = null;
    user.avatarUrl = null;
    return;
  }

  if (!avatarFile) return;

  const nextStorageKey = await persistProfileImageFile(avatarFile, user.avatarStorageKey ?? undefined);
  user.avatarStorageKey = nextStorageKey;
  user.avatarUrl = (await loadPersistedProfileImage(nextStorageKey).catch(() => null)) ?? createProfilePreviewUrl(avatarFile);
}

function refreshStudentDerivedFields(user: StoredAuthUser) {
  if (user.role !== "student" || !user.linkedStudentId) return;

  const student = store.getStudent(user.linkedStudentId);
  if (!student) return;

  user.accountStatus = student.studentStatus === "active" ? "active" : "inactive";
  user.mustChangePassword = student.accessStatus === "temporary_password_pending";
  user.fullName = student.fullName;
  user.birthDate = student.birthDate;
  user.email = normalizeEmail(student.email);
  user.phone = student.phone || null;
  user.notes = student.notes || null;
  user.temporaryPasswordGeneratedAt = student.temporaryPasswordGeneratedAt ?? null;
  user.firstAccessCompletedAt = student.firstAccessCompletedAt ?? null;
  user.updatedAt = nowIso();
}

async function persistDatabaseUser(db: AuthDatabase, user: StoredAuthUser) {
  const index = db.users.findIndex((entry) => entry.id === user.id);
  if (index >= 0) {
    db.users[index] = user;
  } else {
    db.users.push(user);
  }

  saveDatabase(db);
}

function updateLocalSessionForUser(userId: string) {
  const session = loadSession();
  const timestamp = nowIso();

  if (session?.userId === userId) {
    saveSession({
      ...session,
      lastActiveAt: timestamp,
    });
    return;
  }

  saveSession({
    userId,
    createdAt: timestamp,
    lastActiveAt: timestamp,
  });
}

async function getLocalPersistedUserFromSession() {
  const session = loadSession();
  if (!session) return null;

  const db = loadDatabase();
  const user = db.users.find((entry) => entry.id === session.userId);
  if (!user) {
    clearSession();
    return null;
  }

  refreshStudentDerivedFields(user);
  await persistDatabaseUser(db, user);
  return user;
}

async function getLocalResolvedAuthState() {
  const session = loadSession();
  if (!session) {
    return {
      session: null,
      user: null,
      profile: null,
    };
  }

  const user = await getLocalPersistedUserFromSession();
  if (!user) {
    return {
      session: null,
      user: null,
      profile: null,
    };
  }

  const safeUser = stripSensitiveFields(user);
  return {
    session: mapLocalSessionToResolvedSession(safeUser, session),
    user: safeUser,
    profile: mapAuthUserToProfile(safeUser),
  };
}

function assertStrongPassword(password: string) {
  const checks = validateStrongPassword(password);
  if (!checks.minLength || !checks.uppercase || !checks.lowercase || !checks.number || !checks.special) {
    throw new AuthServiceError(
      "weak_password",
      "password",
      "A nova senha precisa ter pelo menos 8 caracteres, com letra maiuscula, minuscula, numero e caractere especial.",
    );
  }
}

function normalizePlanType(value: unknown): TeacherPlanType {
  return value === "pro" ? "pro" : "basic";
}

function normalizeSubscriptionStatus(value: unknown, planType: TeacherPlanType): TeacherSubscriptionStatus {
  if (
    value === "trialing" ||
    value === "active" ||
    value === "expired" ||
    value === "blocked" ||
    value === "pending_payment" ||
    value === "canceled"
  ) {
    return value;
  }

  return planType === "pro" ? "active" : "trialing";
}

function getNullableMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveSupabaseProfileRole(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  return normalized === "student" || normalized === "aluno" ? "aluno" : "professor";
}

function buildSupabaseProfilePayload(
  user: User,
  currentProfile: SupabaseProfileRow | null,
  overrides: Partial<SupabaseProfileRow> = {},
): SupabaseProfileRow {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  return {
    id: user.id,
    email: overrides.email ?? currentProfile?.email ?? normalizeEmail(user.email ?? ""),
    full_name: overrides.full_name ?? currentProfile?.full_name ?? getNullableMetadataString(metadata, "full_name"),
    avatar_url: overrides.avatar_url ?? currentProfile?.avatar_url ?? getNullableMetadataString(metadata, "avatar_url"),
    cpf: overrides.cpf ?? currentProfile?.cpf ?? getNullableMetadataString(metadata, "cpf"),
    birth_date: overrides.birth_date ?? currentProfile?.birth_date ?? getNullableMetadataString(metadata, "birth_date"),
    phone: overrides.phone ?? currentProfile?.phone ?? getNullableMetadataString(metadata, "phone"),
    notes: overrides.notes ?? currentProfile?.notes ?? getNullableMetadataString(metadata, "notes"),
    role: overrides.role ?? currentProfile?.role ?? resolveSupabaseProfileRole(metadata.role),
  };
}

function getSupabaseAvatarPath(userId: string) {
  return `${userId}/avatar`;
}

function isLegacyLocalAvatarKey(value?: string | null) {
  return Boolean(value?.startsWith("profile-avatar-"));
}

async function resolveSupabaseAvatarUrl(profile: SupabaseProfileRow | null, avatarStorageKey?: string | null) {
  const profileAvatarUrl = profile?.avatar_url ?? null;
  if (profileAvatarUrl && !profileAvatarUrl.startsWith("blob:")) {
    return profileAvatarUrl;
  }

  if (isLegacyLocalAvatarKey(avatarStorageKey)) {
    return loadPersistedProfileImage(avatarStorageKey).catch(() => profileAvatarUrl);
  }

  return profileAvatarUrl;
}

function inferAvatarMimeType(blob: Blob) {
  if (blob.type === "image/jpeg" || blob.type === "image/png" || blob.type === "image/webp") {
    return blob.type;
  }

  return "image/png";
}

function inferAvatarExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

async function uploadSupabaseAvatar(userId: string, file: File) {
  if (!hasSupabaseRuntimeConfig()) {
    return null;
  }

  const storagePath = getSupabaseAvatarPath(userId);
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(SUPABASE_PROFILE_AVATAR_BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    throw new AuthServiceError("profile_avatar_upload_failed", "avatarFile", error.message);
  }

  const { data } = supabase.storage.from(SUPABASE_PROFILE_AVATAR_BUCKET).getPublicUrl(storagePath);
  return `${data.publicUrl}?v=${Date.now()}`;
}

async function removeSupabaseAvatar(userId: string) {
  if (!hasSupabaseRuntimeConfig()) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(SUPABASE_PROFILE_AVATAR_BUCKET).remove([getSupabaseAvatarPath(userId)]);
  if (error && !error.message.toLowerCase().includes("not found")) {
    throw new AuthServiceError("profile_avatar_remove_failed", "avatarFile", error.message);
  }
}

async function fetchSupabaseProfile(userId: string) {
  if (!hasSupabaseRuntimeConfig()) return null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,avatar_url,cpf,birth_date,phone,notes,role,created_at,updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) return null;
    return (data ?? null) as SupabaseProfileRow | null;
  } catch {
    return null;
  }
}

async function ensureSupabaseProfile(user: User) {
  const currentProfile = await fetchSupabaseProfile(user.id);
  const normalizedEmail = normalizeEmail(user.email ?? "");

  if (currentProfile && currentProfile.email === normalizedEmail) {
    return currentProfile;
  }

  if (!hasSupabaseRuntimeConfig()) {
    return currentProfile;
  }

  try {
    const supabase = getSupabaseClient();
    const payload = buildSupabaseProfilePayload(user, currentProfile, {
      email: normalizedEmail,
    });
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id,email,full_name,avatar_url,cpf,birth_date,phone,notes,role,created_at,updated_at")
      .maybeSingle();

    if (error) {
      return currentProfile;
    }

    return (data ?? currentProfile ?? null) as SupabaseProfileRow | null;
  } catch {
    return currentProfile;
  }
}

async function upsertSupabaseProfile(user: User, overrides: Partial<SupabaseProfileRow> = {}) {
  if (!hasSupabaseRuntimeConfig()) return;

  const currentProfile = await fetchSupabaseProfile(user.id);
  const supabase = getSupabaseClient();
  const payload = buildSupabaseProfilePayload(user, currentProfile, overrides);
  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    throw new AuthServiceError("profile_sync_failed", "form", error.message);
  }
}

async function updateSupabaseProfile(user: User, changes: Partial<SupabaseProfileRow>) {
  if (!hasSupabaseRuntimeConfig()) {
    return null;
  }

  const supabase = getSupabaseClient();
  const existingProfile = await ensureSupabaseProfile(user);
  const { data, error } = await supabase
    .from("profiles")
    .update(changes)
    .eq("id", user.id)
    .select("id,email,full_name,avatar_url,cpf,birth_date,phone,notes,role,created_at,updated_at")
    .maybeSingle();

  if (error) {
    throw new AuthServiceError("profile_update_failed", "form", error.message);
  }

  if (data) {
    return data as SupabaseProfileRow;
  }

  await upsertSupabaseProfile(user, {
    ...changes,
    email: normalizeEmail(user.email ?? ""),
  });

  return (await fetchSupabaseProfile(user.id)) ?? existingProfile;
}

async function migrateLegacySupabaseAvatar(user: User, profile: SupabaseProfileRow | null, avatarStorageKey?: string | null) {
  if (profile?.avatar_url || !isLegacyLocalAvatarKey(avatarStorageKey)) {
    return profile;
  }

  const blob = await loadPersistedProfileImageBlob(avatarStorageKey).catch(() => null);
  if (!blob) {
    return profile;
  }

  try {
    const mimeType = inferAvatarMimeType(blob);
    const file = new File([blob], `avatar.${inferAvatarExtension(mimeType)}`, { type: mimeType });
    const avatarUrl = await uploadSupabaseAvatar(user.id, file);
    if (!avatarUrl) {
      return profile;
    }

    return (await updateSupabaseProfile(user, { avatar_url: avatarUrl })) ?? profile;
  } catch {
    return profile;
  }
}

async function fetchSupabaseStudentAccess(userId: string) {
  if (!hasSupabaseRuntimeConfig()) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .select("id,teacher_id,auth_user_id,must_change_password,full_name,email,phone,birth_date,notes,status,access_status,temporary_password_generated_at,first_access_completed_at,last_login_at,created_at,updated_at")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AuthServiceError("student_context_failed", "form", error.message);
  }

  return (data ?? null) as SupabaseStudentAccessRow | null;
}

async function ensureSupabaseTeacherAccess(user: User) {
  if (!hasSupabaseRuntimeConfig()) {
    return null;
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("provision_current_teacher_account", {
    p_selected_plan: typeof metadata.selected_plan === "string" ? metadata.selected_plan : null,
    p_mock_pro_payment_confirmed: Boolean(metadata.mockProPaymentConfirmed),
  });

  if (error) {
    throw new AuthServiceError("teacher_context_failed", "form", error.message);
  }

  const snapshot = (Array.isArray(data) ? data[0] : data) as TeacherAccessSnapshot | null;
  if (!snapshot) {
    return null;
  }

  return snapshot;
}

function mapSupabaseUserToFallbackAuthUser(user: User, profile: SupabaseProfileRow | null): AuthUser {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const resolvedProfileRole = (profile?.role as "professor" | "aluno" | null | undefined) ?? null;
  const authRole =
    mapSupabaseProfileRoleToAuthRole(resolvedProfileRole) ??
    (resolveSupabaseProfileRole(metadata.role) === "aluno" ? "student" : "coach");

  if (authRole === "student") {
    throw new AuthServiceError("student_context_missing", "form", "Conta de aluno sem vinculo operacional carregado.");
  }

  const planType = normalizePlanType(metadata.selected_plan);
  const subscriptionStatus = normalizeSubscriptionStatus(metadata.subscription_status, planType);

  return {
    id: user.id,
    role: "coach",
    linkedStudentId: null,
    accountStatus: "active",
    mustChangePassword: false,
    temporaryPasswordGeneratedAt: null,
    firstAccessCompletedAt: user.updated_at ?? null,
    fullName: String(profile?.full_name ?? metadata.full_name ?? user.email?.split("@")[0] ?? "Conta Sano+"),
    birthDate: String(profile?.birth_date ?? metadata.birth_date ?? "1990-01-01"),
    cpf: (profile?.cpf ?? metadata.cpf ?? null) as string | null,
    email: normalizeEmail(user.email ?? ""),
    phone: (profile?.phone ?? metadata.phone ?? null) as string | null,
    notes: (profile?.notes ?? metadata.notes ?? null) as string | null,
    avatarStorageKey: profile?.avatar_url ? getSupabaseAvatarPath(user.id) : null,
    avatarUrl: profile?.avatar_url ?? null,
    createdAt: profile?.created_at ?? user.created_at ?? nowIso(),
    updatedAt: profile?.updated_at ?? user.updated_at ?? nowIso(),
    emailVerifiedAt: user.email_confirmed_at ?? null,
    teacherId: user.id,
    teacherPlanType: planType,
    teacherSubscriptionStatus: subscriptionStatus,
    teacherTrialEndsAt: (metadata.trial_ends_at ?? null) as string | null,
    teacherCurrentPeriodEndsAt: (metadata.current_period_ends_at ?? null) as string | null,
    teacherHasActiveAccess: true,
    teacherCanAddStudent: true,
    teacherAccessMessage: null,
  };
}

async function mapSupabaseUserToAuthUser(user: User, profileOverride?: SupabaseProfileRow | null): Promise<AuthUser> {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const legacyAvatarStorageKey = (metadata.avatar_storage_key ?? null) as string | null;
  const ensuredProfile = profileOverride ?? (await ensureSupabaseProfile(user));
  const profile = await migrateLegacySupabaseAvatar(user, ensuredProfile, legacyAvatarStorageKey);
  const avatarStorageKey = (profile?.avatar_url ? getSupabaseAvatarPath(user.id) : null) ?? legacyAvatarStorageKey;
  const avatarUrl = await resolveSupabaseAvatarUrl(profile, avatarStorageKey);
  const authRole =
    mapSupabaseProfileRoleToAuthRole((profile?.role as "professor" | "aluno" | null | undefined) ?? null) ??
    (resolveSupabaseProfileRole(metadata.role) === "aluno"
      ? "student"
      : "coach");

  if (authRole === "student") {
    const student = await fetchSupabaseStudentAccess(user.id);
    if (!student) {
      throw new AuthServiceError("student_context_missing", "form", "Conta de aluno sem vinculo operacional no backend.");
    }

    return {
      id: user.id,
      role: "student",
      linkedStudentId: student.id,
      accountStatus: student.status === "active" ? "active" : "inactive",
      mustChangePassword: student.must_change_password,
      temporaryPasswordGeneratedAt: student.temporary_password_generated_at,
      firstAccessCompletedAt: student.first_access_completed_at,
      fullName: student.full_name,
      birthDate: student.birth_date ?? "1990-01-01",
      cpf: profile?.cpf ?? null,
      email: normalizeEmail(student.email ?? user.email ?? ""),
      phone: student.phone ?? null,
      notes: student.notes ?? null,
      avatarStorageKey,
      avatarUrl,
      createdAt: student.created_at ?? profile?.created_at ?? user.created_at ?? nowIso(),
      updatedAt: student.updated_at ?? profile?.updated_at ?? user.updated_at ?? nowIso(),
      emailVerifiedAt: user.email_confirmed_at ?? null,
      teacherId: student.teacher_id,
      teacherPlanType: null,
      teacherSubscriptionStatus: null,
      teacherTrialEndsAt: null,
      teacherCurrentPeriodEndsAt: null,
      teacherHasActiveAccess: null,
      teacherCanAddStudent: null,
      teacherAccessMessage: null,
    };
  }

  const teacherAccess = await ensureSupabaseTeacherAccess(user);
  const planType = normalizePlanType(teacherAccess?.plan_type ?? metadata.selected_plan);
  const subscriptionStatus = normalizeSubscriptionStatus(
    teacherAccess?.effective_status ?? metadata.subscription_status,
    planType,
  );

  return {
    id: user.id,
    role: "coach",
    linkedStudentId: null,
    accountStatus: teacherAccess?.has_active_access === false ? "inactive" : "active",
    mustChangePassword: false,
    temporaryPasswordGeneratedAt: null,
    firstAccessCompletedAt: user.updated_at ?? null,
    fullName: String(profile?.full_name ?? metadata.full_name ?? user.email?.split("@")[0] ?? "Conta Sano+"),
    birthDate: String(profile?.birth_date ?? metadata.birth_date ?? "1990-01-01"),
    cpf: (profile?.cpf ?? metadata.cpf ?? null) as string | null,
    email: normalizeEmail(user.email ?? ""),
    phone: (profile?.phone ?? metadata.phone ?? null) as string | null,
    notes: (profile?.notes ?? metadata.notes ?? null) as string | null,
    avatarStorageKey,
    avatarUrl,
    createdAt: profile?.created_at ?? user.created_at ?? nowIso(),
    updatedAt: profile?.updated_at ?? user.updated_at ?? nowIso(),
    emailVerifiedAt: user.email_confirmed_at ?? null,
    teacherId: teacherAccess?.teacher_id ?? user.id,
    teacherPlanType: planType,
    teacherSubscriptionStatus: subscriptionStatus,
    teacherTrialEndsAt: teacherAccess?.trial_ends_at ?? null,
    teacherCurrentPeriodEndsAt: teacherAccess?.current_period_ends_at ?? ((metadata.current_period_ends_at ?? null) as string | null),
    teacherHasActiveAccess: teacherAccess?.has_active_access ?? true,
    teacherCanAddStudent: teacherAccess?.can_add_student ?? true,
    teacherAccessMessage: teacherAccess?.access_message ?? null,
  };
}

async function getSupabaseAuthUser() {
  if (!hasSupabaseRuntimeConfig()) return null;

  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return null;

    const profile = await ensureSupabaseProfile(session.user);
    try {
      return await mapSupabaseUserToAuthUser(session.user, profile);
    } catch (error) {
      console.error("Falha ao enriquecer usuario Supabase, usando fallback de coach.", error);
      return mapSupabaseUserToFallbackAuthUser(session.user, profile);
    }
  } catch (error) {
    console.error("Falha ao carregar usuario autenticado do Supabase.", error);
    return null;
  }
}

async function getSupabaseResolvedAuthState() {
  if (!hasSupabaseRuntimeConfig()) {
    return {
      session: null,
      user: null,
      profile: null,
    };
  }

  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return {
        session: null,
        user: null,
        profile: null,
      };
    }

    const profile = await ensureSupabaseProfile(session.user);
    let currentUser: AuthUser;

    try {
      currentUser = await mapSupabaseUserToAuthUser(session.user, profile);
    } catch (error) {
      console.error("Falha ao resolver contexto autenticado completo, usando fallback de coach.", error);
      currentUser = mapSupabaseUserToFallbackAuthUser(session.user, profile);
    }

    return {
      session: {
        userId: session.user.id,
        email: session.user.email ?? null,
        emailVerifiedAt: session.user.email_confirmed_at ?? null,
        provider: "supabase" as const,
        createdAt: session.user.created_at ?? nowIso(),
        lastActiveAt: nowIso(),
      },
      user: currentUser,
      profile: mapAuthUserToProfile(currentUser),
    };
  } catch (error) {
    console.error("Falha ao montar snapshot autenticado do Supabase.", error);
    return {
      session: null,
      user: null,
      profile: null,
    };
  }
}

export class AuthServiceError extends Error {
  code: string;
  field?: string;

  constructor(code: string, field: string | undefined, message: string) {
    super(message);
    this.name = "AuthServiceError";
    this.code = code;
    this.field = field;
  }
}

export const authService = {
  async getAuthSnapshot() {
    if (hasSupabaseRuntimeConfig()) {
      return getSupabaseResolvedAuthState();
    }

    return getLocalResolvedAuthState();
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const snapshot = await this.getAuthSnapshot();
    return snapshot.user;
  },

  async getCurrentSession(): Promise<ResolvedAuthSession | null> {
    const snapshot = await this.getAuthSnapshot();
    return snapshot.session;
  },

  async getCurrentProfile(): Promise<DatabaseUserProfile | null> {
    const snapshot = await this.getAuthSnapshot();
    return snapshot.profile;
  },

  async register(input: RegisterInput): Promise<AuthUser | null> {
    if (!hasSupabaseRuntimeConfig()) {
      const db = loadDatabase();
      const email = normalizeEmail(input.email);

      if (db.users.some((user) => normalizeEmail(user.email) === email)) {
        throw new AuthServiceError("email_in_use", "email", "Ja existe uma conta com este e-mail.");
      }

      const user = createFallbackCoachUser(input);
      await syncAvatar(user, input.avatarFile ?? null, false);
      await persistDatabaseUser(db, user);
      updateLocalSessionForUser(user.id);
      return stripSensitiveFields(user);
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(input.email),
      password: input.password,
      options: {
        emailRedirectTo: buildAuthCallbackUrl("/dashboard"),
        data: {
          role: "professor",
          full_name: input.fullName,
          birth_date: input.birthDate,
          cpf: input.cpf,
          selected_plan: input.selectedPlan,
          mockProPaymentConfirmed: Boolean(input.mockProPaymentConfirmed),
        },
      },
    });

    if (error) {
      const normalizedMessage = error.message.toLowerCase();

      if (normalizedMessage.includes("already registered") || normalizedMessage.includes("already been registered") || normalizedMessage.includes("already exists")) {
        throw new AuthServiceError("email_in_use", "email", "Ja existe uma conta com este e-mail.");
      }

      if (normalizedMessage.includes("password")) {
        throw new AuthServiceError("register_failed", "password", error.message);
      }

      throw new AuthServiceError("register_failed", "form", error.message);
    }

    if (data.user && data.session) {
      const avatarUrl = input.avatarFile ? await uploadSupabaseAvatar(data.user.id, input.avatarFile) : null;

      await upsertSupabaseProfile(data.user, {
        email: normalizeEmail(input.email),
        full_name: input.fullName,
        avatar_url: avatarUrl,
        cpf: input.cpf,
        birth_date: input.birthDate,
        phone: null,
        notes: null,
        role: "professor",
      });
    }

    if (!data.session) {
      return null;
    }

    return this.getCurrentUser();
  },

  async login(input: LoginInput): Promise<AuthUser | null> {
    if (hasSupabaseRuntimeConfig()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(input.email),
        password: input.password,
      });

      if (error) {
        const normalizedMessage = error.message.toLowerCase();
        if (normalizedMessage.includes("email not confirmed")) {
          throw new AuthServiceError("email_not_confirmed", "form", "Confirme seu e-mail para concluir o acesso.");
        }

        throw new AuthServiceError("invalid_credentials", "form", "E-mail ou senha invalidos.");
      }

      const currentUser = await this.getCurrentUser();
      if (currentUser?.role === "student" && currentUser.linkedStudentId) {
        await getSupabaseClient().rpc("touch_student_last_login", {
          p_student_id: currentUser.linkedStudentId,
        });
      }

      return currentUser;
    }

    const db = loadDatabase();
    const email = normalizeEmail(input.email);
    const user = db.users.find((entry) => normalizeEmail(entry.email) === email);

    if (!user || user.password !== input.password) {
      throw new AuthServiceError("invalid_credentials", "form", "E-mail ou senha invalidos.");
    }

    refreshStudentDerivedFields(user);

    if (user.accountStatus !== "active") {
      throw new AuthServiceError("inactive_account", "form", "Esta conta esta inativa no momento.");
    }

    user.updatedAt = nowIso();
    await persistDatabaseUser(db, user);
    updateLocalSessionForUser(user.id);

    if (user.role === "student" && user.linkedStudentId) {
      store.markStudentLastLogin(user.linkedStudentId);
    }

    return stripSensitiveFields(user);
  },

  async logout() {
    if (hasSupabaseRuntimeConfig()) {
      try {
        await getSupabaseClient().auth.signOut();
      } catch {
        // noop
      }
    }

    clearSession();
  },

  async requestPasswordReset(input: ForgotPasswordInput) {
    if (hasSupabaseRuntimeConfig()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(input.email), {
        redirectTo: buildAuthCallbackUrl("/redefinir-senha"),
      });

      if (error) {
        throw new AuthServiceError("password_reset_request_failed", "form", error.message);
      }

      return {
        token: "",
        message: "Se houver uma conta para este e-mail, enviaremos as instrucoes de redefinicao.",
      };
    }

    const db = loadDatabase();
    const email = normalizeEmail(input.email);
    const user = db.users.find((entry) => normalizeEmail(entry.email) === email);

    if (!user) {
      return {
        token: "",
        message: "Se houver uma conta para este e-mail, enviaremos as instrucoes de redefinicao.",
      };
    }

    const token = generateId("reset");
    user.resetPasswordToken = token;
    user.resetPasswordIssuedAt = nowIso();
    user.updatedAt = nowIso();
    await persistDatabaseUser(db, user);

    return {
      token,
      message: "Se houver uma conta para este e-mail, enviaremos as instrucoes de redefinicao.",
    };
  },

  async resetPassword(input: ResetPasswordInput): Promise<AuthUser | null> {
    if (hasSupabaseRuntimeConfig()) {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthServiceError("invalid_reset_token", undefined, "O link de redefinicao e invalido, expirou ou ja foi utilizado.");
      }

      assertStrongPassword(input.password);
      const { error } = await supabase.auth.updateUser({ password: input.password });

      if (error) {
        throw new AuthServiceError("reset_failed", "form", error.message);
      }

      await supabase.auth.signOut();
      return null;
    }

    const db = loadDatabase();
    const token = input.token.trim();
    const user = db.users.find((entry) => entry.resetPasswordToken === token);

    if (!token || !user) {
      throw new AuthServiceError("invalid_reset_token", undefined, "O link de redefinicao e invalido, expirou ou ja foi utilizado.");
    }

    assertStrongPassword(input.password);

    user.password = input.password;
    user.resetPasswordToken = null;
    user.resetPasswordIssuedAt = null;
    user.mustChangePassword = false;
    user.updatedAt = nowIso();

    if (user.role === "student" && user.linkedStudentId) {
      store.completeStudentFirstAccess(user.linkedStudentId, user.updatedAt);
    }

    await persistDatabaseUser(db, user);
    clearSession();
    return null;
  },

  async issueStudentTemporaryAccess(studentId: string) {
    if (hasSupabaseRuntimeConfig()) {
      const response = await invokeSupabaseEdgeFunction<{
        ok: true;
        requestId: string;
        data: {
          result: {
            studentId: string;
            studentName: string;
            email: string;
            temporaryPassword: string;
            generatedAt: string;
          };
        };
      }>(EDGE_FUNCTION_NAMES.teacherAdminActions, {
        body: {
          action: "reset_student_temporary_access",
          payload: { studentId },
        },
      });

      return response.data.result;
    }

    const student = store.getStudent(studentId);
    if (!student) {
      throw new AuthServiceError("student_not_found", undefined, "Aluno nao encontrado.");
    }

    const db = loadDatabase();
    const timestamp = nowIso();
    const temporaryPassword = `Aluno@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const existingUser = db.users.find((entry) => entry.role === "student" && entry.linkedStudentId === studentId);

    if (existingUser) {
      existingUser.password = temporaryPassword;
      existingUser.accountStatus = "active";
      existingUser.mustChangePassword = true;
      existingUser.temporaryPasswordGeneratedAt = timestamp;
      existingUser.firstAccessCompletedAt = null;
      existingUser.fullName = student.fullName;
      existingUser.email = normalizeEmail(student.email);
      existingUser.birthDate = student.birthDate;
      existingUser.phone = student.phone || null;
      existingUser.notes = student.notes || null;
      existingUser.updatedAt = timestamp;
      await persistDatabaseUser(db, existingUser);
      store.resetStudentTemporaryAccess(studentId, timestamp);
    } else {
      const studentUser: StoredAuthUser = {
        id: generateId("student"),
        role: "student",
        linkedStudentId: studentId,
        accountStatus: "active",
        mustChangePassword: true,
        temporaryPasswordGeneratedAt: timestamp,
        firstAccessCompletedAt: null,
        fullName: student.fullName,
        birthDate: student.birthDate,
        cpf: null,
        email: normalizeEmail(student.email),
        phone: student.phone || null,
        notes: student.notes || null,
        avatarStorageKey: null,
        avatarUrl: student.profilePhotoUrl ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        emailVerifiedAt: timestamp,
          teacherId: null,
          teacherPlanType: null,
          teacherSubscriptionStatus: null,
          teacherTrialEndsAt: null,
          teacherCurrentPeriodEndsAt: null,
          teacherHasActiveAccess: null,
          teacherCanAddStudent: null,
          teacherAccessMessage: null,
        password: temporaryPassword,
        resetPasswordToken: null,
        resetPasswordIssuedAt: null,
      };

      await persistDatabaseUser(db, studentUser);
      store.provisionStudentAccess(studentId, studentUser.id, timestamp);
    }

    return {
      studentId,
      studentName: student.fullName,
      email: normalizeEmail(student.email),
      temporaryPassword,
      generatedAt: timestamp,
    };
  },

  async completeFirstAccess(input: CompleteFirstAccessInput) {
    assertStrongPassword(input.password);
    if (hasSupabaseRuntimeConfig()) {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new AuthServiceError("not_authenticated", undefined, "Sua sessao expirou. Entre novamente.");
      }

      const studentContext = await fetchSupabaseStudentAccess(user.id);
      if (!studentContext || studentContext.access_status !== "temporary_password_pending") {
        throw new AuthServiceError("first_access_not_available", undefined, "Este fluxo nao esta disponivel para a conta atual.");
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: input.password,
      });

      if (passwordError) {
        throw new AuthServiceError("first_access_failed", "password", passwordError.message);
      }

      const { error: firstAccessError } = await supabase.rpc("mark_student_first_access_complete", {
        p_student_id: studentContext.id,
      });

      if (firstAccessError) {
        throw new AuthServiceError("first_access_failed", "form", firstAccessError.message);
      }

      await supabase.rpc("touch_student_last_login", {
        p_student_id: studentContext.id,
      });

      return this.getCurrentUser();
    }

    const db = loadDatabase();
    const currentUser = await getLocalPersistedUserFromSession();

    if (!currentUser || currentUser.role !== "student" || !currentUser.linkedStudentId || !currentUser.mustChangePassword) {
      throw new AuthServiceError("first_access_not_available", undefined, "Este fluxo nao esta disponivel para a conta atual.");
    }

    currentUser.password = input.password;
    currentUser.mustChangePassword = false;
    currentUser.firstAccessCompletedAt = nowIso();
    currentUser.updatedAt = currentUser.firstAccessCompletedAt;

    store.completeStudentFirstAccess(currentUser.linkedStudentId, currentUser.firstAccessCompletedAt);
    store.markStudentLastLogin(currentUser.linkedStudentId);

    await persistDatabaseUser(db, currentUser);
    updateLocalSessionForUser(currentUser.id);
    return stripSensitiveFields(currentUser);
  },

  async updateProfile(input: UpdateProfileInput) {
    const parsed = updateProfileSchema.safeParse({
      fullName: input.fullName,
      birthDate: input.birthDate,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
    });

    if (!parsed.success) {
      throw new AuthServiceError("invalid_profile", "form", parsed.error.issues[0]?.message ?? "Perfil invalido.");
    }

    const supabaseUser = hasSupabaseRuntimeConfig() ? await getSupabaseAuthUser() : null;
    if (supabaseUser) {
      const {
        data: { user },
      } = await getSupabaseClient().auth.getUser();

      if (!user) {
        throw new AuthServiceError("not_authenticated", undefined, "Sua sessao expirou. Entre novamente.");
      }

      let avatarUrl = supabaseUser.avatarUrl ?? null;

      if (input.removeAvatar) {
        await removeSupabaseAvatar(user.id);
        avatarUrl = null;
      } else if (input.avatarFile) {
        avatarUrl = await uploadSupabaseAvatar(user.id, input.avatarFile);
      }

      const normalizedPhone = normalizePhone(parsed.data.phone ?? "") || null;
      const updatedProfile = await updateSupabaseProfile(user, {
        full_name: parsed.data.fullName,
        avatar_url: avatarUrl,
        birth_date: parsed.data.birthDate,
        phone: normalizedPhone,
        notes: parsed.data.notes ?? null,
      });

      const refreshed = await mapSupabaseUserToAuthUser(user, updatedProfile);
      if (refreshed) {
        return refreshed;
      }
    }

    const db = loadDatabase();
    const currentUser = await getLocalPersistedUserFromSession();
    if (!currentUser) {
      throw new AuthServiceError("not_authenticated", undefined, "Sua sessao expirou. Entre novamente.");
    }

    currentUser.fullName = parsed.data.fullName;
    currentUser.birthDate = parsed.data.birthDate;
    currentUser.phone = normalizePhone(parsed.data.phone ?? "");
    currentUser.notes = parsed.data.notes ?? null;
    currentUser.updatedAt = nowIso();

    await syncAvatar(currentUser, input.avatarFile ?? null, Boolean(input.removeAvatar));
    await persistDatabaseUser(db, currentUser);
    updateLocalSessionForUser(currentUser.id);

    if (currentUser.role === "student" && currentUser.linkedStudentId) {
      await store.updateStudent(currentUser.linkedStudentId, {
        fullName: currentUser.fullName,
        birthDate: currentUser.birthDate,
        phone: currentUser.phone ?? "",
        notes: currentUser.notes ?? "",
        profilePhotoUrl: currentUser.avatarUrl ?? null,
        profilePhotoStorageKey: currentUser.avatarStorageKey ?? null,
      });
    }

    return stripSensitiveFields(currentUser);
  },

  async updateSessionActivity() {
    if (hasSupabaseRuntimeConfig()) {
      return;
    }

    const session = loadSession();
    if (session) {
      saveSession({
        ...session,
        lastActiveAt: nowIso(),
      });
    }
  },

  async setStudentAccountStatus(studentId: string, active: boolean) {
    if (hasSupabaseRuntimeConfig()) {
      await invokeSupabaseEdgeFunction(EDGE_FUNCTION_NAMES.teacherAdminActions, {
        body: {
          action: "set_student_status",
          payload: { studentId, active },
        },
      });
      return this.getCurrentUser();
    }

    const db = loadDatabase();
    const studentUser = db.users.find((entry) => entry.role === "student" && entry.linkedStudentId === studentId);
    if (!studentUser) return null;

    studentUser.accountStatus = active ? "active" : "inactive";
    studentUser.updatedAt = nowIso();
    await persistDatabaseUser(db, studentUser);
    return stripSensitiveFields(studentUser);
  },

  async activateCoachProPlan() {
    const currentUser = await this.getCurrentUser();
    if (!currentUser || currentUser.role !== "coach") {
      throw new AuthServiceError("invalid_role", undefined, "Somente contas de professor podem fazer upgrade.");
    }

    if (hasSupabaseRuntimeConfig()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc("confirm_mock_pro_payment", {
        p_teacher_id: currentUser.teacherId ?? null,
      });

      if (error) {
        throw new AuthServiceError("upgrade_failed", "form", error.message);
      }

      return this.getCurrentUser();
    }

    const db = loadDatabase();
    const localUser = await getLocalPersistedUserFromSession();
    if (!localUser || localUser.role !== "coach") {
      throw new AuthServiceError("invalid_role", undefined, "Somente contas de professor podem fazer upgrade.");
    }

    localUser.teacherPlanType = "pro";
    localUser.teacherSubscriptionStatus = "active";
    localUser.teacherCurrentPeriodEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    localUser.teacherHasActiveAccess = true;
    localUser.teacherCanAddStudent = true;
    localUser.teacherAccessMessage = null;
    localUser.updatedAt = nowIso();
    await persistDatabaseUser(db, localUser);
    updateLocalSessionForUser(localUser.id);
    return stripSensitiveFields(localUser);
  },

  clearAllAuthData() {
    clearSession();
    removeStorage(AUTH_DB_STORAGE_KEY);
  },
};
