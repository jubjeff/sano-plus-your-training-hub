import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PagamentoSucesso() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_34%)]" />
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="section-shell p-8 flex flex-col items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Pagamento aprovado!</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Seu acesso está sendo preparado. Em instantes você receberá um e-mail com suas credenciais para acessar o Sano+.
            </p>
          </div>
          <div className="w-full rounded-2xl border border-border bg-card/60 p-4 text-left space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximos passos</p>
            {[
              "Verifique sua caixa de e-mail (e a pasta de spam).",
              "Use as credenciais recebidas para fazer o primeiro acesso.",
              "No primeiro login, você criará uma nova senha.",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{i + 1}</span>
                {step}
              </div>
            ))}
          </div>
          <Button asChild className="w-full">
            <Link to="/">Ir para o login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
