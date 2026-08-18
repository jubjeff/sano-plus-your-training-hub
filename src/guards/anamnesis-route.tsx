import { Navigate } from "react-router-dom";
import { useAuthorization } from "@/auth/use-authorization";

/**
 * Portao da avaliacao inicial do aluno.
 *
 * Espelha o FirstAccessRoute: enquanto students.anamnesis_completed_at for nulo,
 * o aluno e mantido em /minha-avaliacao e nao alcanca o portal. Vale apenas para
 * alunos criados a partir da migration 20260818000007 — os anteriores foram
 * dispensados no backfill.
 */
export default function AnamnesisRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isProfileLoading, isAuthenticated, isStudent, requiresFirstAccess, requiresAnamnesis } =
    useAuthorization();

  if (isLoading || isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="section-shell w-full max-w-sm p-6 text-center">
          <p className="text-sm font-medium text-foreground">Preparando sua avaliação...</p>
          <p className="mt-2 text-sm text-muted-foreground">Validando sessão e perfil para continuar.</p>
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

  // A senha temporaria vem antes: nao faz sentido preencher a ficha inteira
  // ainda com credencial provisoria.
  if (requiresFirstAccess) {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  if (!requiresAnamnesis) {
    return <Navigate to="/aluno/dashboard" replace />;
  }

  return <>{children}</>;
}
