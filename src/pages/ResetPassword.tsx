import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";
import PasswordStrength from "@/components/PasswordStrength";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { AuthServiceError } from "@/lib/auth-service";
import { mapZodErrors, resetPasswordSchema } from "@/lib/auth-validators";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { logout, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const isSupabaseMode = hasSupabaseConfig();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(isSupabaseMode);
  const [tokenError, setTokenError] = useState<string | null>(!isSupabaseMode && !token ? "O link de redefinicao esta incompleto ou invalido." : null);

  useEffect(() => {
    if (!isSupabaseMode) return;

    let active = true;

    const validateRecoverySession = async () => {
      try {
        const supabase = getSupabaseClient();
        const hasRecoveryPendingFlag =
          typeof window !== "undefined" && Boolean(window.sessionStorage.getItem("sano-recovery-pending"));

        for (let attempt = 0; attempt < (hasRecoveryPendingFlag ? 8 : 1); attempt += 1) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!active) return;

          if (session) {
            setTokenError(null);
            if (typeof window !== "undefined") {
              window.sessionStorage.removeItem("sano-recovery-pending");
            }
            return;
          }

          if (attempt < (hasRecoveryPendingFlag ? 7 : 0)) {
            await new Promise((resolve) => window.setTimeout(resolve, 400));
          }
        }

        if (active) {
          setTokenError("O link de redefinicao e invalido, expirou ou ja foi utilizado.");
        }
      } catch {
        if (active) {
          setTokenError("Nao foi possivel validar o link de redefinicao agora. Solicite um novo link.");
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
  }, [isSupabaseMode]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isSupabaseMode && !token) {
      setTokenError("O link de redefinicao esta incompleto ou invalido.");
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
      await resetPassword({ token, password: parsed.data.password });
      if (isSupabaseMode) {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("sano-recovery-pending");
        }
        await logout();
      }
      toast.success("Senha redefinida com sucesso. Entre com sua nova senha para continuar.");
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        if (error.code === "invalid_reset_token") {
          setTokenError(error.message);
        } else {
          setErrors(error.field ? { [error.field]: error.message } : { form: error.message });
        }
      } else {
        setErrors({ form: "Nao foi possivel redefinir sua senha agora. Tente novamente." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Defina uma nova senha"
      subtitle="Escolha uma senha forte para restaurar o acesso com seguranca e continuar de onde parou."
      footer={
        <span>
          Precisa de um novo link?{" "}
          <Link to="/esqueci-senha" className="font-medium text-primary transition-colors hover:text-primary/80">
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
                Solicite um novo link para continuar com a redefinicao.
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
