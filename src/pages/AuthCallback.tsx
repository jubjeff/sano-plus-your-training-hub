import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "@/components/AuthShell";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/auth/use-auth";
import { sanitizeInternalRedirectPath } from "@/lib/auth-redirects";
import { getSupabaseClient, hasSupabaseRuntimeConfig } from "@/integrations/supabase/client";

const RECOVERY_PENDING_STORAGE_KEY = "sano-recovery-pending";
const RECOVERY_STARTED_AT_STORAGE_KEY = "sano-recovery-started-at";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let active = true;

    const resolveAuthCallback = async () => {
      const nextPath = sanitizeInternalRedirectPath(searchParams.get("next"), "/dashboard");

      try {
        if (!hasSupabaseRuntimeConfig()) {
          if (active) {
            navigate(nextPath, { replace: true });
          }
          return;
        }

        const supabase = getSupabaseClient();
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const authType = hashParams.get("type") ?? searchParams.get("type");
        const code = searchParams.get("code");
        const isRecoveryFlow = authType === "recovery" || nextPath === "/redefinir-senha";

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        }

        if (isRecoveryFlow) {
          window.sessionStorage.setItem(RECOVERY_PENDING_STORAGE_KEY, "true");
          window.sessionStorage.setItem(RECOVERY_STARTED_AT_STORAGE_KEY, new Date().toISOString());
        } else {
          window.sessionStorage.removeItem(RECOVERY_PENDING_STORAGE_KEY);
          window.sessionStorage.removeItem(RECOVERY_STARTED_AT_STORAGE_KEY);
          await refreshUser();
        }

        if (active) {
          navigate(isRecoveryFlow ? "/redefinir-senha" : nextPath, { replace: true });
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "Não foi possível concluir a autenticação.";
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
      title="Concluindo autenticação"
      subtitle="Estamos validando seu acesso para continuar a experiência exatamente de onde você parou."
    >
      <div className="rounded-[24px] border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
        Aguarde alguns instantes enquanto preparamos seu acesso.
      </div>
    </AuthShell>
  );
}
