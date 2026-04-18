import { Navigate } from "react-router-dom";
import { useAuthorization } from "@/auth/use-authorization";

export default function FirstAccessRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isProfileLoading, isAuthenticated, isStudent, requiresFirstAccess } = useAuthorization();

  if (isLoading || isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="section-shell w-full max-w-sm p-6 text-center">
          <p className="text-sm font-medium text-foreground">Preparando seu acesso...</p>
          <p className="mt-2 text-sm text-muted-foreground">Validando sessao e perfil para continuar.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (!isStudent) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!requiresFirstAccess) {
    return <Navigate to="/aluno/dashboard" replace />;
  }

  return <>{children}</>;
}
