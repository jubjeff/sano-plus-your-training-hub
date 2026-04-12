import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="section-shell w-full max-w-sm p-6 text-center">
          <p className="text-sm font-medium text-foreground">Preparando sua sessao...</p>
          <p className="mt-2 text-sm text-muted-foreground">Verificando credenciais e restaurando o acesso.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/?redirect=${encodeURIComponent(redirectTo)}`} replace />;
  }

  if (user?.role === "coach" && user.teacherHasActiveAccess === false && location.pathname !== "/perfil") {
    return <Navigate to="/perfil" replace />;
  }

  if (user?.role === "student" && user.mustChangePassword && location.pathname !== "/primeiro-acesso") {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  return <>{children}</>;
}
