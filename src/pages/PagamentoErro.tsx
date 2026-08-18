import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PagamentoErro() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.08),transparent_34%)]" />
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="section-shell p-8 flex flex-col items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/15">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Pagamento não aprovado</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Não foi possível processar seu pagamento. Isso pode acontecer por limite no cartão, dados incorretos ou recusa do banco emissor.
            </p>
          </div>
          <div className="w-full rounded-2xl border border-border bg-card/60 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">O que fazer</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Tente com outro cartão ou método de pagamento</li>
              <li>• Verifique o limite disponível</li>
              <li>• Use o Pix — aprovação imediata</li>
            </ul>
          </div>
          <Button asChild className="w-full">
            <Link to="/planos">Tentar novamente</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
