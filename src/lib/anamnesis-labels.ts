/**
 * Rotulos dos campos de anamnese.
 *
 * O banco guarda os valores em slug (hipertrofia, academia_completa, manha...)
 * e a interface precisa exibi-los por extenso. Vivia duplicado dentro de
 * AnamnesisQueue.tsx; extraido quando o perfil do aluno passou a exibir a
 * mesma ficha, para nao existirem duas tabelas de rotulos divergindo.
 *
 * Os valores vem de VALID_GOALS / VALID_LEVELS / VALID_EQUIPMENT / VALID_TIMES
 * em supabase/functions/anamnesis-submit/index.ts — se um lado mudar, o outro
 * precisa acompanhar.
 */

export const GOAL_LABELS: Record<string, string> = {
  hipertrofia: "Hipertrofia",
  emagrecimento: "Emagrecimento",
  condicionamento: "Condicionamento",
  recomposicao: "Recomposição corporal",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  academia_completa: "Academia completa",
  halteres_casa: "Halteres em casa",
  elasticos: "Elásticos",
  sem_equipamento: "Sem equipamento",
};

export const TIME_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

/** Escala do Deep Squat, igual a usada no formulario publico. */
export const DEEP_SQUAT_LABELS: Record<number, string> = {
  0: "Não conseguiu realizar",
  1: "Muita dificuldade",
  2: "Com compensações",
  3: "Executou corretamente",
};

export function labelFor(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value;
}

export function equipmentList(values: string[] | null | undefined): string {
  if (!values?.length) return "—";
  return values.map((v) => EQUIPMENT_LABELS[v] ?? v).join(", ");
}
