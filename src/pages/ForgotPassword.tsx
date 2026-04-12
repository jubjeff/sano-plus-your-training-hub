import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { AuthServiceError } from "@/lib/auth-service";
import { forgotPasswordSchema, mapZodErrors, normalizeEmail } from "@/lib/auth-validators";

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(mapZodErrors(parsed.error));
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await requestPasswordReset(parsed.data as { email: string });
      setIssuedToken(result.token);
      setSubmittedEmail(parsed.data.email);
      toast.success("Se houver uma conta para este e-mail, enviaremos as instrucoes de redefinicao.");
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setErrors(error.field ? { [error.field]: error.message } : { form: error.message });
      } else {
        setErrors({ form: "Nao foi possivel iniciar a recuperacao agora. Tente novamente." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Recupere seu acesso"
      subtitle="Informe seu e-mail para iniciar a redefinicao de senha com uma resposta segura e discreta."
      footer={
        <span>
          Lembrou sua senha?{" "}
          <Link to="/" className="font-medium text-primary transition-colors hover:text-primary/80">
            Voltar para o login
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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setEmail((current) => normalizeEmail(current))}
            placeholder="seu@email.com"
            className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.email ? <p className="text-xs font-medium text-destructive">{errors.email}</p> : null}
        </div>

        {errors.form ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : "Continuar"}
        </Button>
      </form>

      {submittedEmail ? (
        <div className="mt-4 rounded-[24px] border border-primary/20 bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Se existir uma conta com o e-mail <span className="font-semibold">{submittedEmail}</span>, o link de redefinicao foi enviado.
              </p>
              <p className="text-sm text-muted-foreground">
                Verifique sua caixa de entrada e tambem a pasta de spam. O link abrira a tela correta para definir uma nova senha.
              </p>
              {issuedToken ? (
                <Button asChild variant="outline">
                  <Link to={`/redefinir-senha?token=${encodeURIComponent(issuedToken)}`}>
                    Abrir redefinicao
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
