import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeInternalRedirectPath } from "@/lib/supabase/auth-redirects";

export default function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="section-shell w-full max-w-sm p-6 text-center">
          <p className="text-sm font-medium text-foreground">Carregando acesso...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const redirectTo =
      sanitizeInternalRedirectPath(params.get("redirect"), "") ||
      (user?.role === "student"
        ? (user.mustChangePassword ? "/primeiro-acesso" : "/aluno/dashboard")
        : user?.teacherHasActiveAccess === false
        ? "/perfil"
        : "/dashboard");
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
