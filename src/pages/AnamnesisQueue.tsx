import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Phone,
  RefreshCw,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { getSupabaseClient } from "@/integrations/supabase";

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

function AnamnesisCard({ anamnesis, onStatusChange }: { anamnesis: Anamnesis; onStatusChange: (id: string, status: AnamnesisStatus) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();
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

  function handleCreateStudent() {
    const params = new URLSearchParams({
      nome: anamnesis.full_name,
      email: anamnesis.email,
      telefone: anamnesis.phone,
      objetivo: GOAL_LABELS[anamnesis.goal] ?? anamnesis.goal,
      anamnesisId: anamnesis.id,
    });
    navigate(`/alunos?nova=1&${params.toString()}`);
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
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{anamnesis.email}</p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(anamnesis.phone)}</span>
            <span className="flex items-center gap-1"><Dumbbell className="h-3.5 w-3.5" />{GOAL_LABELS[anamnesis.goal] ?? anamnesis.goal}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{EXPERIENCE_LABELS[anamnesis.experience_level] ?? anamnesis.experience_level}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{anamnesis.available_days_per_week}x/sem · {anamnesis.session_duration}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(anamnesis.submitted_at)}</span>
          </div>
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
            <Button size="sm" variant="outline" onClick={handleCreateStudent} className="h-8 text-xs">
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              Criar aluno
            </Button>
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
  const [anamneses, setAnamneses] = useState<Anamnesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | AnamnesisStatus>("all");

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
            <AnamnesisCard key={a.id} anamnesis={a} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
