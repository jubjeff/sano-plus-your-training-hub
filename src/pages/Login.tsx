import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { AuthServiceError } from "@/lib/auth-service";
import { loginSchema, mapZodErrors } from "@/lib/auth-validators";
import { sanitizeInternalRedirectPath } from "@/lib/supabase/auth-redirects";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(mapZodErrors(parsed.error));
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const currentUser = await login(parsed.data);
      const params = new URLSearchParams(location.search);
      const redirectTo =
        sanitizeInternalRedirectPath(params.get("redirect"), "") ||
        (currentUser?.role === "student"
          ? currentUser.mustChangePassword
            ? "/primeiro-acesso"
            : "/aluno/dashboard"
          : currentUser?.teacherHasActiveAccess === false
          ? "/perfil"
          : "/dashboard");
      toast.success("Acesso liberado com sucesso.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setErrors(error.field ? { [error.field]: error.message } : { form: error.message });
      } else {
        setErrors({ form: "Nao foi possivel entrar agora. Tente novamente." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Acesse sua conta"
      subtitle="Entre com seguranca para acompanhar alunos, treinos e a operacao diaria do Sano+."
      footer={
        <span>
          Novo por aqui?{" "}
          <Link to="/criar-conta" className="font-medium text-primary transition-colors hover:text-primary/80">
            Criar conta
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="seu@email.com"
            className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.email ? <p className="text-xs font-medium text-destructive">{errors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <PasswordField
            id="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Digite sua senha"
            error={errors.password}
          />
          {errors.password ? <p className="text-xs font-medium text-destructive">{errors.password}</p> : null}
        </div>

        <div className="flex items-center justify-end">
          <Link to="/esqueci-senha" className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
            Esqueci minha senha
          </Link>
        </div>

        {errors.form ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}
