import { useState } from "react";
import QRCode from "react-qr-code";
import { CheckCircle2, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { buildPixPayload } from "@/lib/pix";
import { getSupabaseClient } from "@/integrations/supabase";
import { EDGE_FUNCTION_NAMES } from "@/integrations/supabase/function-contracts";

type Step = "qr" | "confirm" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  pixKey: string;
  coachName: string;
  planName: string;
  amount: number;
  anamnesisId: string;
  planoId: string;
}

export default function PixPaymentModal({
  open, onClose,
  pixKey, coachName, planName, amount,
  anamnesisId, planoId,
}: Props) {
  const [step, setStep] = useState<Step>("qr");
  const [payerNote, setPayerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const pixPayload = buildPixPayload({
    pixKey,
    merchantName: coachName,
    amount,
    description: `Sano+ ${planName}`,
    txId: `SANO${anamnesisId.replace(/-/g, "").slice(0, 20)}`,
  });

  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
  }).format(amount);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pixPayload);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar. Copie o texto manualmente.");
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.functions.invoke(EDGE_FUNCTION_NAMES.pixPaymentSubmit, {
        body: { mode: "submit", anamnesisId, planoId, payerNote: payerNote.trim() || null },
      });
      if (error) throw error;
      setStep("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao registrar pagamento.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={step !== "done" ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-md rounded-[28px] border border-border bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={step !== "done" ? onClose : undefined}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        {step === "qr" && (
          <div className="flex flex-col items-center gap-5">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pagar com PIX</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
                {planName} — {formattedAmount}<span className="text-sm font-normal text-muted-foreground">/mês</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Para: <strong>{coachName}</strong></p>
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <QRCode value={pixPayload} size={200} />
            </div>

            <div className="w-full">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Código copia e cola</p>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                <code className="flex-1 truncate text-xs text-foreground">{pixPayload.slice(0, 48)}…</code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <Button className="w-full" onClick={() => setStep("confirm")}>
              Já paguei — confirmar pagamento
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              O acesso será liberado após o personal confirmar o recebimento.
            </p>
          </div>
        )}

        {step === "confirm" && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Confirmar pagamento</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-foreground">Informe os detalhes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Deixe uma observação para facilitar a identificação do seu pagamento (opcional).
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Observação (opcional)</label>
              <Textarea
                value={payerNote}
                onChange={(e) => setPayerNote(e.target.value)}
                placeholder="Ex: Paguei pelo Pix às 14h, nome completo: João Silva"
                rows={3}
                maxLength={300}
              />
              <p className="text-right text-xs text-muted-foreground">{payerNote.length}/300</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("qr")} disabled={submitting}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando…</> : "Enviar confirmação"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Confirmação enviada!</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Seu personal foi notificado e vai verificar o pagamento em breve. Você receberá um e-mail com o acesso assim que for aprovado.
              </p>
            </div>
            <Button className="w-full" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
