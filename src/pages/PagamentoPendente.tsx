import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PagamentoPendente() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.10),transparent_34%)]" />
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="section-shell p-8 flex flex-col items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning/15">
            <Clock className="h-10 w-10 text-warning" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Pagamento pendente</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Seu pedido foi recebido! Assim que o pagamento for confirmado, seu acesso será liberado automaticamente e você receberá um e-mail.
            </p>
          </div>
          <div className="w-full rounded-2xl border border-border bg-card/60 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Se pagou com Pix ou boleto</p>
            <p className="text-sm text-muted-foreground">A confirmação pode levar até <strong className="text-foreground">2 dias úteis</strong>. Você receberá um e-mail assim que o pagamento for processado.</p>
          </div>
          <div className="flex gap-3 w-full">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/planos">Ver planos</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to="/">Ir para o login</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
