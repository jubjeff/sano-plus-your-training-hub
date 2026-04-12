import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthShell from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";
import PasswordStrength from "@/components/PasswordStrength";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { AuthServiceError } from "@/lib/auth-service";
import { mapZodErrors, resetPasswordSchema } from "@/lib/auth-validators";

export default function FirstAccessPassword() {
  const navigate = useNavigate();
  const { completeFirstAccess, user } = useAuth();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(mapZodErrors(parsed.error));
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await completeFirstAccess({ password: parsed.data.password });
      toast.success("Senha criada com sucesso.");
      navigate("/aluno/dashboard", { replace: true });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setErrors(error.field ? { [error.field]: error.message } : { form: error.message });
      } else {
        setErrors({ form: "Nao foi possivel concluir o primeiro acesso agora. Tente novamente." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Crie sua nova senha"
      subtitle={`Este e o primeiro acesso de ${user?.fullName || "sua conta"}. Antes de entrar no sistema, defina uma senha pessoal e segura.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-[24px] border border-primary/20 bg-primary/10 p-4 text-sm text-muted-foreground">
          A senha provisoria vale apenas para este primeiro login. Voce so acessa a area do aluno depois de concluir esta troca.
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <PasswordField
            id="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Crie sua nova senha"
            error={errors.password}
          />
          {errors.password ? <p className="text-xs font-medium text-destructive">{errors.password}</p> : null}
        </div>

        <PasswordStrength password={form.password} />

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <PasswordField
            id="confirmPassword"
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Repita a nova senha"
            error={errors.confirmPassword}
          />
          {errors.confirmPassword ? <p className="text-xs font-medium text-destructive">{errors.confirmPassword}</p> : null}
        </div>

        {errors.form ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Concluir primeiro acesso"}
        </Button>
      </form>
    </AuthShell>
  );
}
