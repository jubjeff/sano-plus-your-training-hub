import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  studentName: string;
  temporaryPassword: string;
}

export default function StudentTemporaryPasswordDialog({ open, onOpenChange, email, studentName, temporaryPassword }: Props) {
  const copyPassword = async () => {
    await navigator.clipboard.writeText(temporaryPassword);
    toast.success("Senha provisoria copiada.");
  };

  const copyAccessData = async () => {
    await navigator.clipboard.writeText(
      `Aluno: ${studentName}\nE-mail: ${email}\nSenha provisoria: ${temporaryPassword}\nNo primeiro acesso, sera obrigatorio criar uma nova senha.`,
    );
    toast.success("Dados de acesso copiados.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Acesso provisorio gerado</DialogTitle>
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
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Senha provisoria</p>
            <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-all font-mono text-sm text-foreground">{temporaryPassword}</span>
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={copyPassword}>
              <Copy className="h-4 w-4" />
              Copiar senha
            </Button>
            <Button type="button" onClick={copyAccessData}>
              <Copy className="h-4 w-4" />
              Copiar dados de acesso
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
