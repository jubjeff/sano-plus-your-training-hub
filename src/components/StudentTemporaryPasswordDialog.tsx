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
  const accessPayload = {
    studentName,
    email,
    phone,
    temporaryPassword,
    accessLink,
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(temporaryPassword);
    toast.success("Senha provisoria copiada.");
  };

  const copyAccessData = async () => {
    await navigator.clipboard.writeText(buildStudentAccessCopyText(accessPayload));
    toast.success("Dados de acesso copiados.");
  };

  const copyWhatsappMessage = async () => {
    await navigator.clipboard.writeText(buildStudentAccessWhatsappMessage(accessPayload));
    toast.success("Mensagem para WhatsApp copiada.");
  };

  const openWhatsappRedirect = () => {
    window.open(buildStudentAccessWhatsappUrl(accessPayload), "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Acesso provisorio gerado</DialogTitle>
          <DialogDescription>
            O aluno entra com estes dados e sera obrigado a criar uma nova senha antes de acessar o dashboard.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="rounded-[24px] border border-primary/20 bg-primary/10 p-4 text-sm">
            <p className="font-medium text-foreground">{studentName}</p>
            <p className="mt-2 text-muted-foreground">
              Compartilhe esta senha com seguranca. O aluno sera obrigado a trocar a senha no primeiro acesso antes de entrar no sistema.
            </p>
          </div>

          <div className="rounded-[24px] border border-border/60 bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">E-mail</p>
            <p className="mt-2 text-sm text-foreground">{email}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Link de acesso</p>
            <a
              href={accessLink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 break-all text-sm text-primary transition-colors hover:text-primary/80"
            >
              {accessLink}
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Senha provisoria</p>
            <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-all font-mono text-sm text-foreground">{temporaryPassword}</span>
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
          </div>

          <div className="rounded-[24px] border border-border/60 bg-background/50 p-4 text-sm">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  {emailDelivery?.status === "sent"
                    ? "E-mail enviado automaticamente."
                    : emailDelivery?.status === "failed"
                    ? "O aluno foi criado, mas o e-mail automatico falhou."
                    : "Envio automatico indisponivel neste ambiente."}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {emailDelivery?.message ?? "Use os botoes abaixo para compartilhar os dados manualmente."}
                </p>
                {emailDelivery?.status === "failed" && emailDelivery.details ? (
                  <p className="mt-2 text-xs text-muted-foreground/80">{emailDelivery.details}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={copyPassword}>
              <Copy className="h-4 w-4" />
              Copiar senha
            </Button>
            <Button type="button" variant="outline" onClick={copyWhatsappMessage}>
              <Copy className="h-4 w-4" />
              Copiar mensagem
            </Button>
            <Button type="button" onClick={copyAccessData}>
              <Copy className="h-4 w-4" />
              Copiar dados de acesso
            </Button>
            <Button type="button" onClick={openWhatsappRedirect}>
              <MessageCircleMore className="h-4 w-4" />
              Enviar por WhatsApp
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
