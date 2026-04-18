import { mapSupabaseProfileRoleToAuthRole } from "@/integrations/supabase/profile-mappers";
import type { AuthRole, AuthUser } from "@/auth/types";
import type { DatabaseUserProfile } from "@/types/profile";

type AuthorizationSubject = {
  user: AuthUser | null;
  profile?: DatabaseUserProfile | null;
};

export function resolveAuthorizedRole(subject: AuthorizationSubject): AuthRole | null {
  const profileRole = subject.profile ? mapSupabaseProfileRoleToAuthRole(subject.profile.role) : null;
  return profileRole ?? subject.user?.role ?? null;
}

export function hasAuthorizedRole(subject: AuthorizationSubject, role: AuthRole) {
  return resolveAuthorizedRole(subject) === role;
}

export function isStudentRole(subject: AuthorizationSubject) {
  return hasAuthorizedRole(subject, "student");
}

export function isCoachRole(subject: AuthorizationSubject) {
  return hasAuthorizedRole(subject, "coach");
}

export function requiresFirstAccess(subject: AuthorizationSubject) {
  return isStudentRole(subject) && Boolean(subject.user?.mustChangePassword);
}

export function requiresCoachProfileAccess(subject: AuthorizationSubject) {
  return isCoachRole(subject) && subject.user?.teacherHasActiveAccess === false;
}

export function getAuthorizedHomePath(subject: AuthorizationSubject) {
  if (requiresFirstAccess(subject)) {
    return "/primeiro-acesso";
  }

  if (isStudentRole(subject)) {
    return "/aluno/dashboard";
  }

  if (requiresCoachProfileAccess(subject)) {
    return "/perfil";
  }

  return "/dashboard";
}
