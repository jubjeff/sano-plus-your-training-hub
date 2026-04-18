import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Mail } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { Button } from "@/components/ui/button";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const email = useMemo(() => searchParams.get("email")?.trim() ?? "", [searchParams]);

  return (
    <AuthShell
      title="Verifique seu e-mail"
      subtitle="Seu cadastro foi criado com sucesso. Falta apenas confirmar o e-mail para liberar o primeiro login no Sano+."
      footer={
        <span>
          Ja confirmou?{" "}
          <Link to="/" className="font-medium text-primary transition-colors hover:text-primary/80">
            Voltar para o login
          </Link>
        </span>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[24px] border border-primary/20 bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Enviamos um e-mail de confirmacao para liberar seu acesso.</p>
              <p className="text-sm text-muted-foreground">
                {email ? (
                  <>
                    Confira a caixa de entrada de <span className="font-medium text-foreground">{email}</span> e clique no link recebido.
                  </>
                ) : (
                  "Confira sua caixa de entrada e clique no link recebido para confirmar sua conta."
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border/60 bg-background/60 p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Depois da confirmacao, voce podera entrar normalmente com e-mail e senha.</p>
              <p>Se nao encontrar a mensagem, verifique tambem a pasta de spam ou promocoes.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="flex-1">
            <Link to="/">Ir para o login</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/criar-conta">Cadastrar outra conta</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
