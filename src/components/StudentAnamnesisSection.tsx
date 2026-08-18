import { useEffect, useState } from "react";
import { ClipboardList, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { getSupabaseClient } from "@/integrations/supabase";
import {
  DEEP_SQUAT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  TIME_LABELS,
  equipmentList,
  labelFor,
} from "@/lib/anamnesis-labels";

type StudentAnamnesis = {
  id: string;
  submitted_at: string;
  age: number | null;
  weight_kg: number | null;
  goal: string | null;
  experience_level: string | null;
  available_days_per_week: number | null;
  session_duration: string | null;
  preferred_time: string | null;
  available_equipment: string[] | null;
  injury_history: string | null;
  has_trained_before: boolean | null;
  stopped_training_duration: string | null;
  deep_squat_score: number | null;
  deep_squat_obs: string | null;
  media_deletado: boolean;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  );
}

/**
 * Ficha de avaliacao do aluno dentro do perfil.
 *
 * Antes esses dados so existiam na fila /anamneses, desligada do aluno: o
 * professor via a ficha na chegada e depois nao tinha mais onde consulta-la
 * enquanto montava o treino — justamente quando peso, nivel, equipamentos e
 * lesoes importam.
 */
export default function StudentAnamnesisSection({ studentId }: { studentId: string }) {
  const [anamnesis, setAnamnesis] = useState<StudentAnamnesis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getSupabaseClient()
      .from("anamneses")
      .select(
        "id,submitted_at,age,weight_kg,goal,experience_level,available_days_per_week,session_duration,preferred_time,available_equipment,injury_history,has_trained_before,stopped_training_duration,deep_squat_score,deep_squat_obs,media_deletado",
      )
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setAnamnesis((data as StudentAnamnesis | null) ?? null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [studentId]);

  if (loading) return null;

  if (!anamnesis) {
    return (
      <section className="section-shell p-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold">Avaliação inicial</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Este aluno ainda não preencheu a avaliação. Alunos criados a partir de agora são levados à ficha
          no primeiro acesso, antes de entrar no portal.
        </p>
      </section>
    );
  }

  const trained = anamnesis.has_trained_before
    ? `Sim${anamnesis.stopped_training_duration ? ` (parou há ${anamnesis.stopped_training_duration})` : ""}`
    : "Não";

  return (
    <section className="section-shell p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-xl font-semibold">Avaliação inicial</h2>
            <p className="text-sm text-muted-foreground">
              Preenchida em {new Date(anamnesis.submitted_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
        <Link
          to="/anamneses"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver ficha completa
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Objetivo" value={labelFor(GOAL_LABELS, anamnesis.goal)} />
        <Field label="Nível" value={labelFor(EXPERIENCE_LABELS, anamnesis.experience_level)} />
        <Field label="Peso" value={anamnesis.weight_kg != null ? `${anamnesis.weight_kg} kg` : "—"} />
        <Field label="Idade" value={anamnesis.age != null ? `${anamnesis.age} anos` : "—"} />
        <Field
          label="Disponibilidade"
          value={
            anamnesis.available_days_per_week
              ? `${anamnesis.available_days_per_week}x/semana · ${anamnesis.session_duration ?? "—"}`
              : "—"
          }
        />
        <Field label="Horário" value={labelFor(TIME_LABELS, anamnesis.preferred_time)} />
        <Field label="Já treinou antes" value={trained} />
        <Field
          label="Deep Squat"
          value={
            anamnesis.deep_squat_score != null
              ? `${anamnesis.deep_squat_score}/3 — ${DEEP_SQUAT_LABELS[anamnesis.deep_squat_score] ?? ""}`
              : "—"
          }
        />
        <Field label="Equipamentos" value={equipmentList(anamnesis.available_equipment)} />
      </div>

      {/* Lesoes ganham destaque: e o dado que restringe a prescricao. */}
      <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          Lesões e limitações
        </p>
        <p className="mt-1 text-sm text-foreground">{anamnesis.injury_history?.trim() || "Nenhuma relatada"}</p>
      </div>

      {anamnesis.deep_squat_obs?.trim() && (
        <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Observações do Deep Squat
          </p>
          <p className="mt-1 text-sm text-foreground">{anamnesis.deep_squat_obs}</p>
        </div>
      )}

      {anamnesis.media_deletado && (
        <p className="mt-3 text-xs text-muted-foreground">
          As fotos posturais desta ficha já expiraram do servidor. Elas foram anexadas no e-mail que você
          recebeu quando a avaliação chegou.
        </p>
      )}
    </section>
  );
}
