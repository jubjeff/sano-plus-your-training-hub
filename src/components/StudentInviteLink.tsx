import { Copy, Link2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/auth/use-auth";

/**
 * Link de convite do professor.
 *
 * Vivia inline dentro de AnamnesisQueue.tsx. Extraido para aparecer tambem em
 * /alunos, que e onde a decisao acontece: quem quer captar aluno clica em
 * "Novo aluno", e ali nao havia nada indicando que existe um caminho em que o
 * proprio aluno se cadastra e ja entrega a avaliacao completa. O caminho melhor
 * ficava escondido atras do pior.
 *
 * O `t` aceita tanto teachers.id quanto o auth user_id — anamnesis-submit
 * resolve os dois.
 */
export default function StudentInviteLink({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { user } = useAuth();

  const inviteLink = user?.teacherId
    ? `${window.location.origin}/anamnese?t=${user.teacherId}`
    : null;

  if (!inviteLink) return null;

  const whatsappText = `Olá! Para começarmos seu treino, preencha sua ficha de avaliação neste link: ${inviteLink}`;
  // Sem numero no wa.me: o WhatsApp abre a lista de contatos para o professor
  // escolher. Aluno novo ainda nao esta cadastrado, entao nao ha telefone.
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  function handleCopy() {
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => toast.success("Link copiado! Compartilhe com seus alunos."))
      .catch(() => toast.error("Não foi possível copiar. Copie manualmente."));
  }

  return (
    <div className="section-shell p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">
          {variant === "compact" ? "Convidar aluno" : "Seu link de anamnese"}
        </p>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {variant === "compact"
          ? "Envie este link e o aluno preenche a avaliação completa sozinho — fotos, objetivo, lesões e equipamentos. A ficha cai na sua fila já vinculada a você."
          : "Compartilhe este link com seus alunos. Cada submissão ficará vinculada a você automaticamente."}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground">
          {inviteLink}
        </code>

        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={handleCopy} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-1.5 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
          >
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          </Button>

          <Button size="sm" variant="outline" onClick={() => window.open(inviteLink, "_blank")}>
            Abrir
          </Button>
        </div>
      </div>
    </div>
  );
}
