import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";
import PasswordStrength from "@/components/PasswordStrength";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/auth/use-auth";
import { AuthServiceError } from "@/services/auth.service";
import { getSupabaseClient, hasSupabaseRuntimeConfig } from "@/integrations/supabase/client";
import { mapZodErrors, resetPasswordSchema } from "@/lib/auth-validators";

const RECOVERY_PENDING_STORAGE_KEY = "sano-recovery-pending";
const RECOVERY_STARTED_AT_STORAGE_KEY = "sano-recovery-started-at";
const RECOVERY_LINK_WINDOW_MS = 5 * 60 * 1000;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const tokenHash = useMemo(() => searchParams.get("token_hash")?.trim() ?? "", [searchParams]);
  const recoveryHashError = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorDescription = hashParams.get("error_description")?.trim();
    const errorCode = hashParams.get("error_code")?.trim();

    if (errorDescription) {
      return decodeURIComponent(errorDescription.replaceAll("+", " "));
    }

    if (errorCode === "otp_expired") {
      return "O link de redefinição expirou ou já foi utilizado.";
    }

    return null;
  }, []);
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(hasSupabaseRuntimeConfig() && !token && !tokenHash);
  const [tokenError, setTokenError] = useState<string | null>(
    recoveryHashError ?? (hasSupabaseRuntimeConfig() || token || tokenHash ? null : "O link de redefinição está incompleto ou inválido."),
  );

  const clearRecoveryState = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.removeItem(RECOVERY_PENDING_STORAGE_KEY);
    window.sessionStorage.removeItem(RECOVERY_STARTED_AT_STORAGE_KEY);
  };

  useEffect(() => {
    let active = true;

    const validateRecoverySession = async () => {
      if (!hasSupabaseRuntimeConfig() || token || recoveryHashError) {
        return;
      }

      setIsCheckingSession(true);
      setTokenError(null);

      try {
        const supabase = getSupabaseClient();
        const recoveryPending = window.sessionStorage.getItem(RECOVERY_PENDING_STORAGE_KEY) === "true";
        const recoveryStartedAt = window.sessionStorage.getItem(RECOVERY_STARTED_AT_STORAGE_KEY);
        const recoveryAge = recoveryStartedAt ? Date.now() - new Date(recoveryStartedAt).getTime() : 0;

        if (recoveryStartedAt && (Number.isNaN(recoveryAge) || recoveryAge > RECOVERY_LINK_WINDOW_MS)) {
          await supabase.auth.signOut();
          clearRecoveryState();
          if (active) {
            setTokenError("O link de redefinição expirou. Solicite um novo link e tente novamente.");
          }
          return;
        }

        if (tokenHash) {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();

          if (!currentSession) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: "recovery",
            });

            if (verifyError) {
              throw new AuthServiceError("invalid_reset_token", undefined, "O link de redefinição expirou ou já foi utilizado.");
            }
          }

          window.sessionStorage.setItem(RECOVERY_PENDING_STORAGE_KEY, "true");
          if (!recoveryStartedAt) {
            window.sessionStorage.setItem(RECOVERY_STARTED_AT_STORAGE_KEY, new Date().toISOString());
          }
        }

        for (let attempt = 0; attempt < (recoveryPending || tokenHash ? 5 : 1); attempt += 1) {
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            throw error;
          }

          if (data.session) {
            if (active) {
              setTokenError(null);
            }
            return;
          }

          await new Promise((resolve) => {
            window.setTimeout(resolve, 250);
          });
        }

        if (active) {
          clearRecoveryState();
          setTokenError("O link de redefinição expirou ou não foi validado corretamente.");
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "Não foi possível validar o link de redefinição.";
          clearRecoveryState();
          setTokenError(message);
        }
      } finally {
        if (active) {
          setIsCheckingSession(false);
        }
      }
    };

    void validateRecoverySession();

    return () => {
      active = false;
    };
  }, [token, tokenHash, recoveryHashError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token && !tokenHash && !hasSupabaseRuntimeConfig()) {
      setTokenError("O link de redefinição está incompleto ou inválido.");
      return;
    }

    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(mapZodErrors(parsed.error));
      return;
    }

    setErrors({});
    setTokenError(null);
    setIsSubmitting(true);

    try {
      if (hasSupabaseRuntimeConfig()) {
        const supabase = getSupabaseClient();
        const recoveryStartedAt = window.sessionStorage.getItem(RECOVERY_STARTED_AT_STORAGE_KEY);
        const recoveryAge = recoveryStartedAt ? Date.now() - new Date(recoveryStartedAt).getTime() : Number.POSITIVE_INFINITY;

        if (Number.isNaN(recoveryAge) || recoveryAge > RECOVERY_LINK_WINDOW_MS) {
          await supabase.auth.signOut();
          clearRecoveryState();
          throw new AuthServiceError("invalid_reset_token", undefined, "O link de redefinição expirou ou já foi utilizado.");
        }
      }

      await resetPassword({ token, password: parsed.data.password });
      clearRecoveryState();
      toast.success("Senha redefinida com sucesso. Entre com sua nova senha para continuar.");
      navigate("/?reset=success", { replace: true });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        if (error.code === "invalid_reset_token") {
          setTokenError(error.message);
        } else {
          setErrors(error.field ? { [error.field]: error.message } : { form: error.message });
        }
      } else {
        setErrors({ form: "Não foi possível redefinir sua senha agora. Tente novamente." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestNewLink = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    clearRecoveryState();

    if (hasSupabaseRuntimeConfig()) {
      try {
        await getSupabaseClient().auth.signOut();
      } catch {
        // noop
      }
    }

    navigate("/esqueci-senha");
  };

  return (
    <AuthShell
      title="Defina uma nova senha"
      subtitle="Escolha uma senha forte para restaurar o acesso com segurança e continuar de onde parou."
      footer={
        <span>
          Precisa de um novo link?{" "}
          <Link to="/esqueci-senha" onClick={handleRequestNewLink} className="font-medium text-primary transition-colors hover:text-primary/80">
            Solicitar novamente
          </Link>
        </span>
      }
    >
      {tokenError ? (
        <div className="rounded-[24px] border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">{tokenError}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Solicite um novo link para continuar com a redefinição.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <PasswordField
            id="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Digite sua nova senha"
            error={errors.password}
          />
          {errors.password ? <p className="text-xs font-medium text-destructive">{errors.password}</p> : null}
        </div>

        <PasswordStrength password={form.password} />

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <PasswordField
            id="confirmPassword"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Repita a nova senha"
            error={errors.confirmPassword}
          />
          {errors.confirmPassword ? <p className="text-xs font-medium text-destructive">{errors.confirmPassword}</p> : null}
        </div>

        {errors.form ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting || isCheckingSession || Boolean(tokenError)}>
          {isCheckingSession ? "Validando link..." : isSubmitting ? "Redefinindo..." : "Salvar nova senha"}
        </Button>
      </form>
    </AuthShell>
  );
}
