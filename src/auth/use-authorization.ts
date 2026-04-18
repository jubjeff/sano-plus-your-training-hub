import { useMemo } from "react";
import { getAuthorizedHomePath, hasAuthorizedRole, isCoachRole, isStudentRole, requiresCoachProfileAccess, requiresFirstAccess, resolveAuthorizedRole } from "@/auth/authorization";
import { useAuth } from "@/hooks/use-auth";
import type { AuthRole } from "@/auth/types";

export function useAuthorization() {
  const auth = useAuth();

  return useMemo(() => {
    const subject = {
      user: auth.user,
      profile: auth.profile,
    };

    const resolvedRole = resolveAuthorizedRole(subject);

    return {
      ...auth,
      resolvedRole,
      isCoach: isCoachRole(subject),
      isStudent: isStudentRole(subject),
      requiresFirstAccess: requiresFirstAccess(subject),
      requiresCoachProfileAccess: requiresCoachProfileAccess(subject),
      canAccessRole: (role: AuthRole) => hasAuthorizedRole(subject, role),
      getAuthorizedHomePath: () => getAuthorizedHomePath(subject),
    };
  }, [auth]);
}
