export type AuthRole = "coach" | "student";
export type AuthAccountStatus = "active" | "inactive";
export type TeacherPlanType = "basic" | "pro";
export type TeacherSubscriptionStatus = "trialing" | "active" | "expired" | "blocked" | "pending_payment" | "canceled";

export interface AuthUser {
  id: string;
  role: AuthRole;
  linkedStudentId?: string | null;
  accountStatus: AuthAccountStatus;
  mustChangePassword: boolean;
  temporaryPasswordGeneratedAt?: string | null;
  firstAccessCompletedAt?: string | null;
  fullName: string;
  birthDate: string;
  cpf?: string | null;
  email: string;
  phone?: string | null;
  notes?: string | null;
  avatarStorageKey?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  emailVerifiedAt?: string | null;
  teacherId?: string | null;
  teacherPlanType?: TeacherPlanType | null;
  teacherSubscriptionStatus?: TeacherSubscriptionStatus | null;
  teacherTrialEndsAt?: string | null;
  teacherHasActiveAccess?: boolean | null;
  teacherCanAddStudent?: boolean | null;
  teacherAccessMessage?: string | null;
}

export interface AuthSession {
  userId: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface RegisterInput {
  fullName: string;
  birthDate: string;
  cpf: string;
  email: string;
  password: string;
  avatarFile?: File | null;
  selectedPlan: TeacherPlanType;
  mockProPaymentConfirmed?: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface CompleteFirstAccessInput {
  password: string;
}

export interface UpdateProfileInput {
  fullName: string;
  birthDate: string;
  phone?: string | null;
  notes?: string | null;
  avatarFile?: File | null;
  removeAvatar?: boolean;
}
