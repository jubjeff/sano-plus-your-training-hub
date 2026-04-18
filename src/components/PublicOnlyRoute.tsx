import { Navigate, useLocation } from "react-router-dom";
import { useAuthorization } from "@/auth/use-authorization";
import { sanitizeInternalRedirectPath } from "@/lib/auth-redirects";

export default function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading, getAuthorizedHomePath } = useAuthorization();

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
    const redirectTo = sanitizeInternalRedirectPath(params.get("redirect"), "") || getAuthorizedHomePath();
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
