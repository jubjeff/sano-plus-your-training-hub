import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Dumbbell,
  Image,
  Link2,
  Phone,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { getSupabaseClient, invokeSupabaseEdgeFunction, EDGE_FUNCTION_NAMES } from "@/integrations/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { StudentTemporaryAccessResult } from "@/integrations/supabase/function-contracts";

type AnamnesisStatus = "pending_review" | "workout_generated" | "active";

type Anamnesis = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  age: number;
  weight_kg: number;
  goal: string;
  experience_level: string;
  available_days_per_week: number;
  session_duration: string;
  preferred_time: string;
  available_equipment: string[];
  injury_history: string;
  has_trained_before: boolean;
  stopped_training_duration: string | null;
  status: AnamnesisStatus;
  student_id: string | null;
  notes: string | null;
  submitted_at: string;
  // Mídias posturais
  foto_frontal_url: string | null;
  foto_lateral_url: string | null;
  foto_posterior_url: string | null;
  deep_squat_video_frontal_url: string | null;
  deep_squat_video_lateral_url: string | null;
  deep_squat_video_posterior_url: string | null;
  deep_squat_score: number | null;
  deep_squat_obs: string | null;
  // Retenção de mídia
  media_expires_at: string | null;
  media_deletado: boolean;
  media_deletado_em: string | null;
  media_download_confirmado: boolean;
  media_lembrete_enviado: boolean;
};

const GOAL_LABELS: Record<string, string> = {
  hipertrofia: "Hipertrofia",
  emagrecimento: "Emagrecimento",
  condicionamento: "Condicionamento",
  recomposicao: "Recomposição corporal",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  academia_completa: "Academia completa",
  halteres_casa: "Halteres em casa",
  elasticos: "Elásticos",
  sem_equipamento: "Sem equipamento",
};

const TIME_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const STATUS_CONFIG: Record<AnamnesisStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pending_review: { label: "Pendente", variant: "secondary" },
  workout_generated: { label: "Treino gerado", variant: "default" },
  active: { label: "Ativo", variant: "outline" },
};

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Helpers de retenção de mídia ────────────────────────────────────────────

function getDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getHoursRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60));
}

type MediaBadgeProps = { expiresAt: string | null; deletado: boolean; deletadoEm: string | null };

function MediaRetentionBadge({ expiresAt, deletado, deletadoEm }: MediaBadgeProps) {
  if (deletado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Trash2 className="h-2.5 w-2.5" />
        {deletadoEm ? `Deletado em ${formatDate(deletadoEm)}` : "Mídias deletadas"}
      </span>
    );
  }
  if (!expiresAt) return null;

  const hours = getHoursRemaining(expiresAt);
  if (hours === null) return null;

  if (hours <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400">
        <Trash2 className="h-2.5 w-2.5" />
        Expira em breve
      </span>
    );
  }

  const days = getDaysRemaining(expiresAt)!;

  if (hours <= 48) {
    return (
      <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400">
        <AlertTriangle className="h-2.5 w-2.5" />
        Expira em {hours}h
      </span>
    );
  }

  if (days <= 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400">
        <Clock className="h-2.5 w-2.5" />
        Expira em {days}d
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400">
      <CheckCircle2 className="h-2.5 w-2.5" />
      {days}d restantes
    </span>
  );
}

async function downloadFileAsBlob(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar ${filename}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function MediaSection({ anamnesis, onDownloadConfirmed }: { anamnesis: Anamnesis; onDownloadConfirmed: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const supabase = getSupabaseClient();

  const mediaFiles: { url: string; label: string; type: "photo" | "video" }[] = [
    ...(anamnesis.foto_frontal_url ? [{ url: anamnesis.foto_frontal_url, label: "Foto frontal", type: "photo" as const }] : []),
    ...(anamnesis.foto_lateral_url ? [{ url: anamnesis.foto_lateral_url, label: "Foto lateral", type: "photo" as const }] : []),
    ...(anamnesis.foto_posterior_url ? [{ url: anamnesis.foto_posterior_url, label: "Foto posterior", type: "photo" as const }] : []),
    ...(anamnesis.deep_squat_video_frontal_url ? [{ url: anamnesis.deep_squat_video_frontal_url, label: "Vídeo Deep Squat (frontal)", type: "video" as const }] : []),
    ...(anamnesis.deep_squat_video_lateral_url ? [{ url: anamnesis.deep_squat_video_lateral_url, label: "Vídeo Deep Squat (lateral)", type: "video" as const }] : []),
    ...(anamnesis.deep_squat_video_posterior_url ? [{ url: anamnesis.deep_squat_video_posterior_url, label: "Vídeo Deep Squat (posterior)", type: "video" as const }] : []),
  ];

  const hasMedia = mediaFiles.length > 0;

  async function markDownloadConfirmed() {
    await supabase.from("anamneses").update({ media_download_confirmado: true, media_download_confirmado_em: new Date().toISOString() }).eq("id", anamnesis.id);
    onDownloadConfirmed();
  }

  async function handleDownloadAll() {
    setDownloading(true);
    try {
      for (const file of mediaFiles) {
        const ext = file.url.split(".").pop()?.split("?")[0] ?? (file.type === "photo" ? "webp" : "mp4");
        const slug = file.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        await downloadFileAsBlob(file.url, `${slug}.${ext}`);
        await new Promise((r) => setTimeout(r, 300));
      }
      await markDownloadConfirmed();
      toast.success("Download concluído! Mídias salvas localmente.");
    } catch {
      toast.error("Erro ao baixar algumas mídias. Tente baixar individualmente.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadOne(url: string, label: string) {
    try {
      const ext = url.split(".").pop()?.split("?")[0] ?? "webp";
      const slug = label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      await downloadFileAsBlob(url, `${slug}.${ext}`);
      await markDownloadConfirmed();
    } catch {
      toast.error(`Erro ao baixar ${label}.`);
    }
  }

  if (anamnesis.media_deletado) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trash2 className="h-4 w-4" />
          <p className="text-sm font-medium">Mídias removidas automaticamente</p>
        </div>
        {anamnesis.media_deletado_em && (
          <p className="mt-1 text-xs text-muted-foreground">Deletado em {formatDate(anamnesis.media_deletado_em)}. Os dados textuais da anamnese permanecem disponíveis.</p>
        )}
      </div>
    );
  }

  if (!hasMedia) return null;

  const hours = getHoursRemaining(anamnesis.media_expires_at);
  const days = getDaysRemaining(anamnesis.media_expires_at);
  const isUrgent = hours !== null && hours <= 48;
  const isWarning = !isUrgent && days !== null && days <= 5;

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 ${isUrgent ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30" : isWarning ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30" : "border-border bg-card/40"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isUrgent ? (
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 animate-pulse" />
          ) : isWarning ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Download className="h-4 w-4 text-foreground" />
          )}
          <p className={`text-sm font-semibold ${isUrgent ? "text-red-700 dark:text-red-300" : isWarning ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>
            Mídias posturais
            {anamnesis.media_expires_at && !isUrgent && (
              <span className="ml-2 font-normal text-xs text-muted-foreground">
                · disponíveis até {formatDate(anamnesis.media_expires_at)}
              </span>
            )}
            {isUrgent && hours !== null && (
              <span className="ml-2 font-normal text-xs">· deletadas em {hours}h</span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant={isUrgent ? "default" : "outline"}
          onClick={handleDownloadAll}
          disabled={downloading}
          className={`h-7 text-xs gap-1.5 ${isUrgent ? "bg-red-600 hover:bg-red-700 text-white border-0" : ""}`}
        >
          {downloading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          {downloading ? "Baixando..." : "Baixar todas"}
        </Button>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {mediaFiles.map((file) => (
          <div key={file.url} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
            {file.type === "photo" ? (
              <Image className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1 truncate text-xs text-foreground">{file.label}</span>
            <button
              type="button"
              onClick={() => handleDownloadOne(file.url, file.label)}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              title={`Baixar ${file.label}`}
            >
              <Download className="h-3 w-3" />
            </button>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Abrir em nova aba"
            >
              <Link2 className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>

      {anamnesis.media_download_confirmado && (
        <p className="mt-2 flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" /> Download registrado
        </p>
      )}
    </div>
  );
}

// ─── Dialog: Criar aluno a partir da anamnese ────────────────────────────────

function CreateStudentDialog({
  anamnesis,
  open,
  onClose,
  onCreated,
}: {
  anamnesis: Anamnesis;
  open: boolean;
  onClose: () => void;
  onCreated: (studentId: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    fullName: anamnesis.full_name,
    email: anamnesis.email,
    phone: anamnesis.phone.replace(/\D/g, ""),
    birthDate: "",
    startDate: today,
    goal: GOAL_LABELS[anamnesis.goal] ?? anamnesis.goal,
    notes: `Anamnese recebida em ${new Date(anamnesis.submitted_at).toLocaleDateString("pt-BR")}. Objetivo: ${GOAL_LABELS[anamnesis.goal] ?? anamnesis.goal}. Experiência: ${EXPERIENCE_LABELS[anamnesis.experience_level] ?? anamnesis.experience_level}.`,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<StudentTemporaryAccessResult | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleCreate() {
    setSubmitting(true);
    try {
      const response = await invokeSupabaseEdgeFunction<{
        ok: true; requestId: string;
        data: { result: StudentTemporaryAccessResult };
      }>(EDGE_FUNCTION_NAMES.teacherAdminActions, {
        body: {
          action: "create_student_with_temporary_password",
          payload: {
            fullName: form.fullName.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone || null,
            birthDate: form.birthDate || null,
            startDate: form.startDate,
            goal: form.goal.trim(),
            notes: form.notes.trim() || null,
          },
        },
      });

      const studentId = response.data.result.studentId;

      // Vincula o aluno à anamnese e marca como ativo
      const supabase = getSupabaseClient();
      await supabase
        .from("anamneses")
        .update({ student_id: studentId, status: "active", reviewed_at: new Date().toISOString() })
        .eq("id", anamnesis.id);

      setResult(response.data.result);
      onCreated(studentId);
      toast.success(`Aluno ${form.fullName} criado e vinculado à anamnese!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar aluno. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyPassword() {
    if (result?.temporaryPassword) {
      navigator.clipboard.writeText(result.temporaryPassword);
      toast.success("Senha copiada!");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-3xl p-0 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base">Criar aluno a partir da anamnese</DialogTitle>
          </DialogHeader>
        </div>
        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">

        {result ? (
          /* Tela de sucesso */
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{result.studentName} criado!</p>
                <p className="mt-1 text-sm text-muted-foreground">Anamnese vinculada automaticamente ao aluno.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acesso inicial do aluno</p>
              <div className="space-y-1.5">
                <p className="text-sm"><span className="text-muted-foreground">E-mail:</span> <strong>{result.email}</strong></p>
                <div className="flex items-center gap-2">
                  <p className="text-sm flex-1"><span className="text-muted-foreground">Senha temporária:</span> <strong className="font-mono">{result.temporaryPassword}</strong></p>
                  <button onClick={handleCopyPassword} className="rounded-lg border border-border p-1.5 hover:bg-muted">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">No primeiro acesso, o aluno será obrigado a criar uma nova senha.</p>
              </div>
            </div>

            {result.emailDelivery?.status === "sent" && (
              <p className="text-xs text-center text-primary">✓ E-mail com senha temporária enviado para o aluno.</p>
            )}

            <Button className="w-full" onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          /* Formulário de criação */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
              Dados pré-preenchidos da anamnese. Ajuste se necessário.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">Nome completo</Label>
              <Input value={form.fullName} onChange={(e) => setForm(p => ({ ...p, fullName: e.target.value }))} disabled={submitting} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} disabled={submitting} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nascimento <span className="text-muted-foreground">(opc.)</span></Label>
                <Input type="date" value={form.birthDate} onChange={(e) => setForm(p => ({ ...p, birthDate: e.target.value }))} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data de início</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm(p => ({ ...p, startDate: e.target.value }))} disabled={submitting} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Objetivo</Label>
              <Input value={form.goal} onChange={(e) => setForm(p => ({ ...p, goal: e.target.value }))} disabled={submitting} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancelar</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={submitting}>
                {submitting ? "Criando..." : "Criar aluno"}
              </Button>
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card individual de anamnese ──────────────────────────────────────────────

function AnamnesisCard({ anamnesis, onStatusChange, onStudentLinked, onMediaDownloadConfirmed }: {
  anamnesis: Anamnesis;
  onStatusChange: (id: string, status: AnamnesisStatus) => void;
  onStudentLinked: (anamnesisId: string, studentId: string) => void;
  onMediaDownloadConfirmed: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const config = STATUS_CONFIG[anamnesis.status];

  async function handleStatusChange(newStatus: AnamnesisStatus) {
    setUpdating(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("anamneses")
        .update({ status: newStatus, reviewed_at: new Date().toISOString() })
        .eq("id", anamnesis.id);

      if (error) throw error;
      onStatusChange(anamnesis.id, newStatus);
      toast.success("Status atualizado.");
    } catch {
      toast.error("Erro ao atualizar status. Tente novamente.");
    } finally {
      setUpdating(false);
    }
  }


  return (
    <div className="section-shell overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
        {/* Avatar / Initials */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-sm font-bold text-primary">
          {anamnesis.full_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{anamnesis.full_name}</p>
            <Badge variant={config.variant}>{config.label}</Badge>
            <MediaRetentionBadge
              expiresAt={anamnesis.media_expires_at}
              deletado={anamnesis.media_deletado}
              deletadoEm={anamnesis.media_deletado_em}
            />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{anamnesis.email}</p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(anamnesis.phone)}</span>
            <span className="flex items-center gap-1"><Dumbbell className="h-3.5 w-3.5" />{GOAL_LABELS[anamnesis.goal] ?? anamnesis.goal}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{EXPERIENCE_LABELS[anamnesis.experience_level] ?? anamnesis.experience_level}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{anamnesis.available_days_per_week}x/sem · {anamnesis.session_duration}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(anamnesis.submitted_at)}</span>
          </div>

          {anamnesis.media_expires_at && !anamnesis.media_deletado && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {(() => {
                const days = getDaysRemaining(anamnesis.media_expires_at);
                const hours = getHoursRemaining(anamnesis.media_expires_at);
                if (hours !== null && hours <= 48)
                  return `Mídias deletadas em ${hours}h — baixe agora antes que sumam`;
                if (days !== null && days <= 0)
                  return "Mídias expiradas — serão removidas em breve";
                return `Fotos e vídeos disponíveis por mais ${days} dia${days !== 1 ? "s" : ""} — faça o download`;
              })()}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Fechar</> : <><ChevronDown className="h-3.5 w-3.5" /> Ver detalhes</>}
          </button>

          {!anamnesis.student_id && (
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)} className="h-8 text-xs">
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              Criar aluno
            </Button>
          )}
          {anamnesis.student_id && (
            <span className="flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aluno vinculado
            </span>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados físicos</h4>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-muted-foreground">Idade:</span> <span className="font-medium">{anamnesis.age} anos</span></p>
                <p><span className="text-muted-foreground">Peso atual:</span> <span className="font-medium">{anamnesis.weight_kg} kg</span></p>
                <p><span className="text-muted-foreground">Lesões/limitações:</span> <span className="font-medium">{anamnesis.injury_history}</span></p>
                <p>
                  <span className="text-muted-foreground">Já treinou antes:</span>{" "}
                  <span className="font-medium">
                    {anamnesis.has_trained_before
                      ? `Sim${anamnesis.stopped_training_duration ? ` (parou há ${anamnesis.stopped_training_duration})` : ""}`
                      : "Não"}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rotina de treino</h4>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-muted-foreground">Horário preferido:</span> <span className="font-medium">{TIME_LABELS[anamnesis.preferred_time] ?? anamnesis.preferred_time}</span></p>
                <p>
                  <span className="text-muted-foreground">Equipamentos:</span>{" "}
                  <span className="font-medium">
                    {anamnesis.available_equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(", ") || "—"}
                  </span>
                </p>
                {anamnesis.notes && (
                  <p><span className="text-muted-foreground">Notas:</span> <span className="font-medium">{anamnesis.notes}</span></p>
                )}
              </div>
            </div>
          </div>

          {/* Seção de mídias */}
          <MediaSection
            anamnesis={anamnesis}
            onDownloadConfirmed={() => onMediaDownloadConfirmed(anamnesis.id)}
          />

          {/* Status actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">Atualizar status:</span>
            {anamnesis.status !== "pending_review" && (
              <button
                type="button"
                onClick={() => handleStatusChange("pending_review")}
                disabled={updating}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Pendente
              </button>
            )}
            {anamnesis.status !== "workout_generated" && (
              <button
                type="button"
                onClick={() => handleStatusChange("workout_generated")}
                disabled={updating}
                className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
              >
                Marcar treino gerado
              </button>
            )}
            {anamnesis.status !== "active" && (
              <button
                type="button"
                onClick={() => handleStatusChange("active")}
                disabled={updating}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Marcar como ativo
              </button>
            )}
          </div>
        </div>
      )}

      <CreateStudentDialog
        anamnesis={anamnesis}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(studentId) => {
          setDialogOpen(false);
          onStudentLinked(anamnesis.id, studentId);
          onStatusChange(anamnesis.id, "active");
        }}
      />
    </div>
  );
}

const STATUS_FILTERS: { value: "all" | AnamnesisStatus; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending_review", label: "Pendentes" },
  { value: "workout_generated", label: "Treino gerado" },
  { value: "active", label: "Ativas" },
];

export default function AnamnesisQueue() {
  const { user } = useAuth();
  const [anamneses, setAnamneses] = useState<Anamnesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | AnamnesisStatus>("all");

  const anamnesisLink = user?.teacherId
    ? `${window.location.origin}/anamnese?t=${user.teacherId}`
    : null;

  function handleCopyLink() {
    if (!anamnesisLink) return;
    navigator.clipboard.writeText(anamnesisLink).then(() => {
      toast.success("Link copiado! Compartilhe com seus alunos.");
    }).catch(() => {
      toast.error("Não foi possível copiar. Copie manualmente.");
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("anamneses")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setAnamneses((data as Anamnesis[]) ?? []);
    } catch {
      toast.error("Erro ao carregar anamneses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleStatusChange(id: string, newStatus: AnamnesisStatus) {
    setAnamneses((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
    );
  }

  const filtered = filter === "all" ? anamneses : anamneses.filter((a) => a.status === filter);

  const counts = {
    all: anamneses.length,
    pending_review: anamneses.filter((a) => a.status === "pending_review").length,
    workout_generated: anamneses.filter((a) => a.status === "workout_generated").length,
    active: anamneses.filter((a) => a.status === "active").length,
  };

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Fila de Anamneses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Alunos que preencheram o formulário público aguardando revisão.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="self-start">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Aviso fixo de política de retenção de mídia */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              As fotos e vídeos enviados pelos alunos ficam disponíveis por apenas 7 dias
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Após esse prazo, os arquivos são excluídos automaticamente dos nossos servidores para liberar espaço.
              Baixe as mídias de cada anamnese assim que recebê-las. Os dados textuais (nome, objetivo, histórico etc.) são mantidos indefinidamente.
            </p>
          </div>
        </div>
      </div>

      {/* Link personalizado do professor */}
      {anamnesisLink && (
        <div className="section-shell p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Seu link de anamnese</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Compartilhe este link com seus alunos. Cada submissão ficará vinculada a você automaticamente.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-xl border border-border bg-muted px-3 py-2 text-xs font-mono text-foreground">
              {anamnesisLink}
            </code>
            <Button size="sm" onClick={handleCopyLink} className="shrink-0 gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
            <Button size="sm" variant="outline" className="shrink-0"
              onClick={() => window.open(anamnesisLink, "_blank")}>
              Abrir
            </Button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === f.value ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">Nenhuma anamnese encontrada</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {filter === "all"
              ? "Compartilhe o link do formulário com seus alunos para receber as primeiras anamneses."
              : "Nenhuma anamnese com este status no momento."}
          </p>
          {filter === "all" && (
            <div className="mt-2 rounded-2xl border border-border bg-card/60 px-4 py-3 text-left">
              <p className="text-xs font-semibold text-muted-foreground">Link do formulário</p>
              <p className="mt-1 font-mono text-sm text-primary">{window.location.origin}/anamnese</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <AnamnesisCard
              key={a.id}
              anamnesis={a}
              onStatusChange={handleStatusChange}
              onStudentLinked={(anamnesisId, studentId) => {
                setAnamneses((prev) =>
                  prev.map((item) =>
                    item.id === anamnesisId ? { ...item, student_id: studentId, status: "active" } : item,
                  ),
                );
              }}
              onMediaDownloadConfirmed={(id) => {
                setAnamneses((prev) =>
                  prev.map((item) =>
                    item.id === id ? { ...item, media_download_confirmado: true } : item,
                  ),
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
