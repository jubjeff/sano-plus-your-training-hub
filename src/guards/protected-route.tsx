import { Navigate, useLocation } from "react-router-dom";
import { useAuthorization } from "@/auth/use-authorization";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, isProfileLoading, session, resolveGateRedirect } = useAuthorization();

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

  // Os portoes precisam valer em qualquer rota autenticada, nao so nas proprias
  // /primeiro-acesso e /minha-avaliacao: sem isto o aluno digitava
  // /aluno/dashboard e entrava sem trocar a senha nem preencher a avaliacao.
  //
  // A ordem mora em resolveGateRedirect, nao aqui. Quando esta regra era
  // duplicada neste arquivo ela divergiu da original e criou um loop entre os
  // dois portoes para quem tinha ambos pendentes.
  const gateRedirect = resolveGateRedirect(location.pathname);
  if (gateRedirect) {
    return <Navigate to={gateRedirect} replace />;
  }

  return <>{children}</>;
}
