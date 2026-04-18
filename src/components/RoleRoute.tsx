import { Navigate } from "react-router-dom";
import { useAuthorization } from "@/auth/use-authorization";
import type { AuthRole } from "@/auth/types";

export default function RoleRoute({ role, children }: { role: AuthRole; children: React.ReactNode }) {
  const { user, isLoading, isProfileLoading, isAuthenticated, requiresFirstAccess, canAccessRole, getAuthorizedHomePath } = useAuthorization();

  if (isLoading || isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="section-shell w-full max-w-sm p-6 text-center">
          <p className="text-sm font-medium text-foreground">Preparando seu acesso...</p>
          <p className="mt-2 text-sm text-muted-foreground">Validando sessao e perfil para liberar esta area.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (requiresFirstAccess) {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  if (!canAccessRole(role)) {
    return <Navigate to={getAuthorizedHomePath()} replace />;
  }

  return <>{children}</>;
}
