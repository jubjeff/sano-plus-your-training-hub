import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "@/components/AuthShell";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import { sanitizeInternalRedirectPath } from "@/lib/supabase/auth-redirects";

async function resolveSessionFromCallback() {
  const supabase = getSupabaseClient();
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const authCode = searchParams.get("code");

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    return data.session;
  }

  if (authCode) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

    if (error) {
      throw error;
    }

    return data.session;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    let active = true;

    const resolveAuthCallback = async () => {
      const nextPath = sanitizeInternalRedirectPath(searchParams.get("next"), "/dashboard");

      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const hashError = hashParams.get("error_description") || hashParams.get("error");
        const authType = hashParams.get("type");
        const isRecoveryFlow = authType === "recovery" || nextPath.includes("redefinir-senha");
        if (hashError) {
          throw new Error(hashError);
        }

        const session = await resolveSessionFromCallback();

        if (!session) {
          throw new Error(
            nextPath.includes("redefinir-senha")
              ? "O link de redefinicao e invalido, expirou ou ja foi utilizado."
              : "Nao foi possivel concluir a autenticacao com este link.",
          );
        }

        if (!isRecoveryFlow) {
          await refreshUser();
        }

        if (active) {
          if (isRecoveryFlow && typeof window !== "undefined") {
            window.sessionStorage.setItem("sano-recovery-pending", nowIso());
          }
          navigate(nextPath, { replace: true });
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "Nao foi possivel concluir a autenticacao.";
          toast.error(message);
          navigate("/", { replace: true });
        }
      }
    };

    void resolveAuthCallback();

    return () => {
      active = false;
    };
  }, [navigate, refreshUser, searchParams]);

  return (
    <AuthShell
      title="Concluindo autenticacao"
      subtitle="Estamos validando sua sessao com o Supabase e preparando o proximo passo."
    >
      <div className="rounded-[24px] border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
        Aguarde alguns instantes enquanto o retorno da autenticacao e processado.
      </div>
    </AuthShell>
  );
}

function nowIso() {
  return new Date().toISOString();
}
