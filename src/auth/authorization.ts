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

// Segundo portao do aluno, depois da troca de senha. Aluno cadastrado direto
// pelo professor entra sem peso, nivel, equipamentos, lesoes nem avaliacao
// postural — dados que os proprios templates de treino pressupoem.
export function requiresAnamnesis(subject: AuthorizationSubject) {
  return isStudentRole(subject) && Boolean(subject.user?.requiresAnamnesis);
}

export function requiresCoachProfileAccess(subject: AuthorizationSubject) {
  return isCoachRole(subject) && subject.user?.teacherHasActiveAccess === false;
}

export function getAuthorizedHomePath(subject: AuthorizationSubject) {
  if (requiresFirstAccess(subject)) {
    return "/primeiro-acesso";
  }

  // Depois da senha: a avaliacao. A ordem importa — trocar a senha primeiro
  // evita o aluno preencher a ficha inteira ainda com credencial temporaria.
  if (requiresAnamnesis(subject)) {
    return "/minha-avaliacao";
  }

  if (isStudentRole(subject)) {
    return "/aluno/dashboard";
  }

  if (requiresCoachProfileAccess(subject)) {
    return "/perfil";
  }

  return "/dashboard";
}
