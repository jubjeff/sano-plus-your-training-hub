import { useRef, useState } from "react";
import QRCode from "react-qr-code";
import {
  CheckCircle2, ChevronDown, Copy, FileText,
  ImageIcon, Loader2, QrCode, UploadCloud, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { buildPixPayload } from "@/lib/pix";
import { validatePaymentProofFile } from "@/lib/payment-proof";
import { getSupabaseClient } from "@/integrations/supabase";
import { EDGE_FUNCTION_NAMES } from "@/integrations/supabase/function-contracts";

type Step = "idle" | "qr" | "upload" | "done";

interface Props {
  studentId: string;
  teacherId: string;
  onSuccess?: () => void;
}

type PixInfo = {
  pixKey: string;
  coachName: string;
  amount: number | null;
  planName: string;
};

async function decodeFnError(fnErr: unknown): Promise<string> {
  try {
    const ctx = (fnErr as { context?: Response }).context;
    if (ctx?.json) {
      const body = await ctx.json() as { error?: { code?: string; message?: string } };
      return body?.error?.message ?? "Erro inesperado.";
    }
  } catch { /* fallback */ }
  return fnErr instanceof Error ? fnErr.message : "Erro inesperado.";
}

export default function StudentPixSection({ studentId, teacherId, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pixInfo, setPixInfo] = useState<PixInfo | null>(null);
  const [payerNote, setPayerNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchPixInfo() {
    if (pixInfo) { setStep("qr"); return; }
    if (!teacherId) {
      setError("Perfil não vinculado a um personal. Entre em contato com o suporte.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: fnErr } = await supabase.functions.invoke(EDGE_FUNCTION_NAMES.pixPaymentSubmit, {
        body: { mode: "info_by_teacher", teacherId, studentId },
      });
      if (fnErr) {
        const msg = await decodeFnError(fnErr);
        setError(msg.includes("nao configurou") || msg.includes("pix_not_configured")
          ? "Pagamento PIX ainda não configurado pelo seu personal. Entre em contato com ele."
          : msg);
        return;
      }
      setPixInfo((data as { ok: boolean; data: PixInfo }).data);
      setStep("qr");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar PIX.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(file: File) {
    const err = validatePaymentProofFile(file);
    if (err) { toast.error(err); return; }

    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(file);
    setProofPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
  }

  function clearFile() {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!proofFile) { toast.error("Selecione o comprovante antes de enviar."); return; }

    setUploading(true);
    try {
      const supabase = getSupabaseClient();
      const ext = proofFile.name.split(".").pop()?.toLowerCase() ?? "jpg";

      // 1. Solicita URL assinada de upload ao edge function (service role bypassa RLS)
      const { data: urlData, error: urlErr } = await supabase.functions.invoke(
        EDGE_FUNCTION_NAMES.pixPaymentSubmit,
        { body: { mode: "get_upload_url", studentId, fileExt: ext } },
      );
      if (urlErr) throw new Error(await decodeFnError(urlErr));

      const { token, path, readUrl } = (urlData as { ok: boolean; data: { signedUrl: string; token: string; path: string; readUrl: string | null } }).data;

      // 2. Faz upload usando uploadToSignedUrl (não precisa de permissão no bucket)
      const { error: uploadErr } = await supabase.storage
        .from("payment-proofs")
        .uploadToSignedUrl(path, token, proofFile, { contentType: proofFile.type });

      if (uploadErr) throw new Error(`Falha no upload: ${uploadErr.message}`);

      // 3. Registra na assinatura e notifica o professor
      const { data, error: fnErr } = await supabase.functions.invoke(EDGE_FUNCTION_NAMES.pixPaymentSubmit, {
        body: {
          mode: "submit_renewal",
          teacherId,
          studentId,
          proofUrl: readUrl,
          payerNote: payerNote.trim() || null,
        },
      });

      if (fnErr) throw new Error(await decodeFnError(fnErr));
      if (!data?.ok) throw new Error(data?.error?.message ?? "Erro desconhecido.");

      setStep("done");
      clearFile();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar comprovante.");
    } finally {
      setUploading(false);
    }
  }

  const formattedAmount = pixInfo?.amount
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(pixInfo.amount)
    : null;

  const pixPayload = pixInfo
    ? buildPixPayload({
        pixKey: pixInfo.pixKey,
        merchantName: pixInfo.coachName,
        amount: pixInfo.amount ?? undefined,
        description: pixInfo.planName,
        txId: `REN${studentId.replace(/-/g, "").slice(0, 20)}`,
      })
    : null;

  return (
    <div className="rounded-[24px] border border-primary/20 bg-primary/5 overflow-hidden">
      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
      />

      {/* Cabeçalho */}
      <button
        type="button"
        onClick={() => step === "idle" || step === "done" ? fetchPixInfo() : setStep("idle")}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-primary/10 transition-colors"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <QrCode className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">Pagar mensalidade via PIX</p>
          <p className="text-xs text-muted-foreground">
            {step === "done"
              ? "Comprovante enviado — aguarde a confirmação do seu personal."
              : formattedAmount
              ? `${formattedAmount}/mês · QR code + envio de comprovante`
              : "Gere o QR code, pague e envie o comprovante"}
          </p>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : step === "done" ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${step !== "idle" ? "rotate-180" : ""}`} />
        )}
      </button>

      {/* Erro */}
      {error && <div className="px-5 pb-4 text-sm text-destructive">{error}</div>}

      {/* ── Step: QR Code ── */}
      {step === "qr" && pixInfo && pixPayload && (
        <div className="border-t border-primary/15 px-5 pb-5 pt-4 space-y-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-2xl border border-border bg-white p-3">
              <QRCode value={pixPayload} size={140} />
            </div>
            <div className="flex-1 min-w-0 space-y-3 w-full">
              {formattedAmount && (
                <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Valor</p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {formattedAmount}<span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Beneficiário</p>
                <p className="mt-1 text-sm font-medium text-foreground">{pixInfo.coachName}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button" variant="outline" size="sm" className="flex-1"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(pixPayload); toast.success("Código PIX copiado!"); }
                    catch { toast.error("Não foi possível copiar."); }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar código
                </Button>
                <Button type="button" size="sm" className="flex-1" onClick={() => setStep("upload")}>
                  Enviar comprovante →
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Após pagar, clique em "Enviar comprovante" para notificar seu personal.
          </p>
        </div>
      )}

      {/* ── Step: Upload comprovante ── */}
      {step === "upload" && (
        <div className="border-t border-primary/15 px-5 pb-5 pt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Comprovante de pagamento</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Envie a captura de tela ou PDF do comprovante do PIX. Aceito: JPG, PNG, WebP ou PDF (máx. 8 MB).
            </p>
          </div>

          {/* Área de seleção de arquivo */}
          {!proofFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border/60 bg-background/50 px-4 py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Clique para selecionar o comprovante</p>
                <p className="mt-0.5 text-xs text-muted-foreground">JPG, PNG, WebP ou PDF · Máx. 8 MB</p>
              </div>
            </button>
          ) : (
            /* Preview do arquivo selecionado */
            <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <button
                type="button"
                onClick={clearFile}
                className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              {proofPreview ? (
                <img
                  src={proofPreview}
                  alt="Preview do comprovante"
                  className="mx-auto max-h-48 rounded-xl object-contain"
                />
              ) : (
                <div className="flex items-center gap-3 px-2 py-1">
                  <FileText className="h-8 w-8 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{proofFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(proofFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full rounded-xl border border-border bg-background/70 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Trocar arquivo
              </button>
            </div>
          )}

          {/* Observação opcional */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Observação (opcional)</p>
            <Textarea
              value={payerNote}
              onChange={(e) => setPayerNote(e.target.value)}
              placeholder="Ex: Pix enviado às 14h, nome: João Silva"
              rows={2}
              maxLength={300}
              className="text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button" variant="outline" size="sm" className="flex-1"
              onClick={() => { clearFile(); setStep("qr"); }}
              disabled={uploading}
            >
              Voltar
            </Button>
            <Button
              type="button" size="sm" className="flex-1"
              onClick={handleSubmit}
              disabled={uploading || !proofFile}
            >
              {uploading
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Enviando…</>
                : <><UploadCloud className="mr-1.5 h-3.5 w-3.5" />Enviar comprovante</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === "done" && (
        <div className="border-t border-primary/15 px-5 pb-4 pt-3">
          <div className="flex items-start gap-2 text-sm text-primary">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Comprovante enviado com sucesso! Seu personal será notificado e aprovará o acesso em breve.</p>
          </div>
        </div>
      )}
    </div>
  );
}
