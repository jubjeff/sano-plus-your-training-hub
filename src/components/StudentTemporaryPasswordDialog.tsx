import { Copy, ExternalLink, KeyRound, MailCheck, MessageCircleMore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { buildStudentAccessCopyText, buildStudentAccessWhatsappMessage, buildStudentAccessWhatsappUrl } from "@/lib/student-temporary-access";
import type { StudentTemporaryAccessResult } from "@/integrations/supabase/function-contracts";

interface Props extends StudentTemporaryAccessResult {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StudentTemporaryPasswordDialog({
  open,
  onOpenChange,
  email,
  phone,
  studentName,
  temporaryPassword,
  accessLink,
  emailDelivery,
}: Props) {
  const accessPayload = { studentName, email, phone, temporaryPassword, accessLink };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(temporaryPassword);
    toast.success("Senha provisória copiada.");
  };

  const copyAccessData = async () => {
    await navigator.clipboard.writeText(buildStudentAccessCopyText(accessPayload));
    toast.success("Dados de acesso copiados.");
  };

  const openWhatsapp = () => {
    window.open(buildStudentAccessWhatsappUrl(accessPayload), "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Acesso provisório gerado</DialogTitle>
          <DialogDescription>
            O aluno entra com estes dados e precisará criar uma nova senha antes de acessar o dashboard.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          {/* Nome do aluno */}
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
            <p className="font-semibold text-foreground">{studentName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Compartilhe esta senha com segurança. O aluno precisará trocar no primeiro acesso.
            </p>
          </div>

          {/* Dados de acesso */}
          <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-muted/30 overflow-hidden">
            {/* E-mail */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">E-mail</p>
              <p className="mt-1 text-sm text-foreground break-all">{email}</p>
            </div>

            {/* Link */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Link de acesso</p>
              <a
                href={accessLink}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-start gap-1.5 text-sm text-primary hover:text-primary/80 break-all leading-snug"
              >
                <span className="break-all">{accessLink}</span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              </a>
            </div>

            {/* Senha */}
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Senha provisória</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-foreground break-all">{temporaryPassword}</span>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Copiar senha"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Status do e-mail */}
          <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-sm">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {emailDelivery?.status === "sent"
                  ? "E-mail enviado automaticamente."
                  : emailDelivery?.status === "failed"
                  ? "Conta criada, mas envio de e-mail falhou."
                  : "Envio automático indisponível neste ambiente."}
              </p>
              {emailDelivery?.message && (
                <p className="mt-0.5 text-xs text-muted-foreground">{emailDelivery.message}</p>
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button type="button" variant="outline" className="w-full" onClick={copyAccessData}>
              <Copy className="h-4 w-4" />
              Copiar dados
            </Button>
            <Button type="button" className="w-full" onClick={openWhatsapp}>
              <MessageCircleMore className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
