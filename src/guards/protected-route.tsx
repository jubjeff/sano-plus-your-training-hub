import { Navigate, useLocation } from "react-router-dom";
import { useAuthorization } from "@/auth/use-authorization";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, isProfileLoading, session, requiresCoachProfileAccess, requiresFirstAccess, requiresAnamnesis } = useAuthorization();

  if (isLoading || (Boolean(session) && (isProfileLoading || !user))) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="section-shell w-full max-w-sm p-6 text-center">
          <p className="text-sm font-medium text-foreground">Preparando sua sessão...</p>
          <p className="mt-2 text-sm text-muted-foreground">Verificando credenciais e restaurando o acesso.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/?redirect=${encodeURIComponent(redirectTo)}`} replace />;
  }

  if (requiresCoachProfileAccess && location.pathname !== "/perfil") {
    return <Navigate to="/perfil" replace />;
  }

  if (requiresFirstAccess && location.pathname !== "/primeiro-acesso") {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  // O portao precisa valer em qualquer rota autenticada, nao so na propria
  // /minha-avaliacao: sem isto o aluno digitava /aluno/dashboard e entrava
  // sem preencher. Mesmo lugar onde requiresFirstAccess e imposto.
  if (requiresAnamnesis && location.pathname !== "/minha-avaliacao") {
    return <Navigate to="/minha-avaliacao" replace />;
  }

  return <>{children}</>;
}
