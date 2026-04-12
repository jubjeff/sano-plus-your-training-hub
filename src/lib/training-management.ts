import type {
  CoachAlertType,
  Student,
  StudentCheckIn,
  StudentEngagementStats,
  StudentEngagementStatus,
  TrainingProgressMode,
  TrainingStructureType,
  WorkoutBlock,
  WorkoutPlan,
} from "@/types";
import { getPaymentDaysOverdue, isWorkoutBlockedByPayment } from "@/lib/student-dashboard";

const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_OPTIONS = [
  { value: 0, key: "monday", label: "Segunda", shortLabel: "Seg" },
  { value: 1, key: "tuesday", label: "Terca", shortLabel: "Ter" },
  { value: 2, key: "wednesday", label: "Quarta", shortLabel: "Qua" },
  { value: 3, key: "thursday", label: "Quinta", shortLabel: "Qui" },
  { value: 4, key: "friday", label: "Sexta", shortLabel: "Sex" },
  { value: 5, key: "saturday", label: "Sabado", shortLabel: "Sab" },
  { value: 6, key: "sunday", label: "Domingo", shortLabel: "Dom" },
] as const;

export const ABCDE_LABELS = ["A", "B", "C", "D", "E"] as const;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTodayWeekIndex(now = new Date()) {
  return (now.getDay() + 6) % 7;
}

function getUniqueCheckInDays(checkIns: StudentCheckIn[]) {
  return Array.from(new Set(checkIns.map((checkIn) => startOfDay(new Date(checkIn.checkedInAt)).toISOString()))).sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );
}

function createPlanId(studentId: string) {
  return `plan-${studentId}`;
}

function normalizeBlockLabel(block: WorkoutBlock, structureType: TrainingStructureType, orderIndex: number) {
  if (structureType === "weekly") {
    const option = WEEKDAY_OPTIONS[block.dayOfWeek ?? orderIndex] ?? WEEKDAY_OPTIONS[orderIndex % WEEKDAY_OPTIONS.length];
    return block.blockLabel ?? option.label;
  }

  const letter = block.letterLabel ?? ABCDE_LABELS[orderIndex] ?? `B${orderIndex + 1}`;
  return block.blockLabel ?? letter;
}

export function getAllowedProgressModes(structureType: TrainingStructureType) {
  if (structureType === "abcde") {
    return ["sequential_progression"] as const;
  }

  return ["fixed_schedule", "sequential_progression"] as const;
}

export function normalizeProgressMode(
  structureType: TrainingStructureType,
  progressMode: TrainingProgressMode | null | undefined,
): TrainingProgressMode {
  const allowed = getAllowedProgressModes(structureType);
  return (allowed as readonly string[]).includes(progressMode as string) ? (progressMode as TrainingProgressMode) : allowed[0] as TrainingProgressMode;
}

export function normalizeWorkoutBlocks(
  blocks: WorkoutBlock[],
  structureType: TrainingStructureType,
): WorkoutBlock[] {
  return blocks.map((block, index) => {
    const dayOption = structureType === "weekly" ? WEEKDAY_OPTIONS[block.dayOfWeek ?? index] ?? WEEKDAY_OPTIONS[index % WEEKDAY_OPTIONS.length] : null;
    const letterLabel = structureType === "abcde" ? block.letterLabel ?? ABCDE_LABELS[index] ?? `B${index + 1}` : null;
    const isRestDay = block.isRestDay ?? (block.blockType === "rest" || block.exercises.length === 0);
    const blockLabel = normalizeBlockLabel(block, structureType, index);

    return {
      ...block,
      blockType: isRestDay ? "rest" : block.blockType ?? "standard",
      blockLabel,
      dayOfWeek: structureType === "weekly" ? dayOption?.value ?? index : null,
      letterLabel,
      orderIndex: block.orderIndex ?? index,
      isRestDay,
      notes: block.notes ?? "",
      estimatedDuration: block.estimatedDuration ?? null,
      exercises: block.exercises,
    };
  });
}

export function createDefaultWorkoutPlan(
  student: Pick<Student, "id" | "startDate" | "nextWorkoutChange" | "workoutUpdatedAt" | "workout">,
  overrides?: Partial<WorkoutPlan>,
): WorkoutPlan {
  const trainingStructureType = overrides?.trainingStructureType ?? "weekly";
  const trainingProgressMode = normalizeProgressMode(trainingStructureType, overrides?.trainingProgressMode ?? "fixed_schedule");
  const createdAt = overrides?.createdAt ?? student.workoutUpdatedAt ?? student.startDate;
  const normalizedBlocks = normalizeWorkoutBlocks(overrides?.blocks ?? student.workout ?? [], trainingStructureType);

  return {
    id: overrides?.id ?? createPlanId(student.id),
    studentId: student.id,
    trainingStructureType,
    trainingProgressMode,
    planName: overrides?.planName ?? "Plano principal",
    isActive: overrides?.isActive ?? true,
    startDate: overrides?.startDate ?? student.startDate,
    endDate: overrides?.endDate ?? null,
    nextWorkoutChangeDate: overrides?.nextWorkoutChangeDate ?? student.nextWorkoutChange ?? null,
    currentSuggestedBlockId: overrides?.currentSuggestedBlockId ?? normalizedBlocks.find((block) => !block.isRestDay)?.id ?? null,
    lastCompletedBlockId: overrides?.lastCompletedBlockId ?? null,
    lastCompletedAt: overrides?.lastCompletedAt ?? null,
    weeklyGoal: overrides?.weeklyGoal ?? 4,
    createdAt,
    updatedAt: overrides?.updatedAt ?? createdAt,
    blocks: normalizedBlocks,
  };
}

export function getStudentWorkoutPlan(student: Student): WorkoutPlan {
  return createDefaultWorkoutPlan(student, student.workoutPlan ?? undefined);
}

export function sortWorkoutBlocks(blocks: WorkoutBlock[]) {
  return [...blocks].sort((left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0));
}

export function getBlockDisplayLabel(block: WorkoutBlock, plan: WorkoutPlan) {
  if (plan.trainingStructureType === "weekly") {
    return block.blockLabel ?? WEEKDAY_OPTIONS[block.dayOfWeek ?? block.orderIndex ?? 0]?.label ?? block.name;
  }

  return block.blockLabel ?? block.letterLabel ?? block.name;
}

function getRecentCheckInsForStudent(studentId: string, checkIns: StudentCheckIn[]) {
  return checkIns
    .filter((checkIn) => checkIn.studentId === studentId)
    .sort((left, right) => new Date(right.checkedInAt).getTime() - new Date(left.checkedInAt).getTime());
}

function getSuggestedBlock(plan: WorkoutPlan, checkIns: StudentCheckIn[]) {
  const blocks = sortWorkoutBlocks(plan.blocks).filter((block) => !block.isRestDay);
  if (blocks.length === 0) return null;

  if (plan.currentSuggestedBlockId) {
    const explicitBlock = blocks.find((block) => block.id === plan.currentSuggestedBlockId);
    if (explicitBlock) return explicitBlock;
  }

  if (!plan.lastCompletedBlockId) return blocks[0];

  const currentIndex = blocks.findIndex((block) => block.id === plan.lastCompletedBlockId);
  if (currentIndex === -1) return blocks[0];
  return blocks[(currentIndex + 1) % blocks.length];
}

export function getNextSuggestedBlock(plan: WorkoutPlan, checkIns: StudentCheckIn[]) {
  if (plan.trainingProgressMode !== "sequential_progression") {
    return null;
  }

  return getSuggestedBlock(plan, checkIns);
}

export function buildStudentPlanCards(student: Student, checkIns: StudentCheckIn[], now = new Date()) {
  const plan = getStudentWorkoutPlan(student);
  const studentCheckIns = getRecentCheckInsForStudent(student.id, checkIns);
  const blocked = isWorkoutBlockedByPayment(student, now);
  const latestBlockIds = new Set(studentCheckIns.slice(0, 2).map((checkIn) => checkIn.workoutBlockId));
  const suggestedBlock = getNextSuggestedBlock(plan, studentCheckIns);
  const todayIndex = getTodayWeekIndex(now);

  if (plan.trainingStructureType === "weekly") {
    return WEEKDAY_OPTIONS.map((weekday) => {
      const block = plan.blocks.find((item) => item.dayOfWeek === weekday.value) ?? null;
      const isCurrent =
        plan.trainingProgressMode === "fixed_schedule"
          ? weekday.value === todayIndex
          : suggestedBlock?.id != null && suggestedBlock.id === block?.id;

      return {
        key: weekday.key,
        label: weekday.label,
        shortLabel: weekday.shortLabel,
        block,
        isCurrent,
        isRestDay: !block || block.isRestDay,
        isBlocked: blocked,
        isRecentlyCompleted: block ? latestBlockIds.has(block.id) : false,
        isSuggested: suggestedBlock?.id === block?.id,
      };
    });
  }

  return sortWorkoutBlocks(plan.blocks).map((block) => ({
    key: block.id,
    label: getBlockDisplayLabel(block, plan),
    shortLabel: block.letterLabel ?? getBlockDisplayLabel(block, plan),
    block,
    isCurrent: suggestedBlock?.id === block.id,
    isRestDay: Boolean(block.isRestDay),
    isBlocked: blocked,
    isRecentlyCompleted: latestBlockIds.has(block.id),
    isSuggested: suggestedBlock?.id === block.id,
  }));
}

export function getPrimaryWorkoutForStudent(student: Student, checkIns: StudentCheckIn[], now = new Date()) {
  const plan = getStudentWorkoutPlan(student);
  const studentCheckIns = getRecentCheckInsForStudent(student.id, checkIns);
  const blocks = sortWorkoutBlocks(plan.blocks);

  if (plan.trainingProgressMode === "fixed_schedule" && plan.trainingStructureType === "weekly") {
    const todayIndex = getTodayWeekIndex(now);
    const block = blocks.find((item) => item.dayOfWeek === todayIndex) ?? null;
    const weekday = WEEKDAY_OPTIONS[todayIndex];

    return {
      plan,
      mode: "today" as const,
      label: weekday.label,
      title: block?.name ?? "Sem treino programado",
      block,
      lastCompletedBlock: plan.lastCompletedBlockId ? blocks.find((item) => item.id === plan.lastCompletedBlockId) ?? null : null,
      nextBlock: null,
      contextualMessage: block
        ? block.isRestDay
          ? "Hoje e um dia de descanso ou recuperacao."
          : `Treino planejado para ${weekday.label.toLowerCase()}.`
        : "Sem treino programado para hoje.",
    };
  }

  const suggestedBlock = getSuggestedBlock(plan, studentCheckIns);
  const lastCompletedBlock = plan.lastCompletedBlockId ? blocks.find((item) => item.id === plan.lastCompletedBlockId) ?? null : null;
  const actionableBlocks = blocks.filter((block) => !block.isRestDay);
  const nextBlock =
    suggestedBlock && actionableBlocks.length > 0
      ? actionableBlocks[(actionableBlocks.findIndex((block) => block.id === suggestedBlock.id) + 1) % actionableBlocks.length]
      : null;

  return {
    plan,
    mode: "next" as const,
    label: suggestedBlock ? getBlockDisplayLabel(suggestedBlock, plan) : "Sem proximo treino",
    title: suggestedBlock?.name ?? "Sem treino configurado",
    block: suggestedBlock,
    lastCompletedBlock,
    nextBlock,
    contextualMessage: suggestedBlock
      ? "Sua sequencia continua do ultimo bloco pendente."
      : "Ainda nao existe um proximo treino sugerido para este plano.",
  };
}

function countBestStreak(uniqueDays: string[]) {
  if (uniqueDays.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = startOfDay(new Date(uniqueDays[index - 1])).getTime();
    const currentDay = startOfDay(new Date(uniqueDays[index])).getTime();
    if (currentDay - previous === DAY_MS) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

export function getStudentEngagementStats(student: Student, checkIns: StudentCheckIn[], now = new Date()): StudentEngagementStats {
  const plan = getStudentWorkoutPlan(student);
  const studentCheckIns = getRecentCheckInsForStudent(student.id, checkIns);
  const weekStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - getTodayWeekIndex(now)));
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const weeklyCheckIns = studentCheckIns.filter((checkIn) => new Date(checkIn.checkedInAt) >= weekStart).length;
  const monthlyCheckIns = studentCheckIns.filter((checkIn) => new Date(checkIn.checkedInAt) >= monthStart).length;
  const weeklyGoal = plan.weeklyGoal ?? 4;
  const attendanceRate = Math.min(100, Math.round((monthlyCheckIns / Math.max(weeklyGoal * 4, 1)) * 100));
  const uniqueDays = getUniqueCheckInDays(studentCheckIns).reverse();
  const bestStreak = countBestStreak(uniqueDays);
  const daysWithoutCheckIn = studentCheckIns[0]?.checkedInAt
    ? Math.floor((startOfDay(now).getTime() - startOfDay(new Date(studentCheckIns[0].checkedInAt)).getTime()) / DAY_MS)
    : Math.floor((startOfDay(now).getTime() - startOfDay(new Date(student.startDate)).getTime()) / DAY_MS);

  let currentStreak = 0;
  let cursor = startOfDay(now).getTime();
  const uniqueDescending = getUniqueCheckInDays(studentCheckIns).sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
  for (const day of uniqueDescending) {
    const currentDay = startOfDay(new Date(day)).getTime();
    if (currentDay === cursor || (currentStreak === 0 && currentDay === cursor - DAY_MS)) {
      currentStreak += 1;
      cursor = currentDay - DAY_MS;
      continue;
    }
    if (currentDay !== cursor) break;
  }

  let engagementStatus: StudentEngagementStatus = "active";
  if (daysWithoutCheckIn >= 7) {
    engagementStatus = "disengaged";
  } else if (daysWithoutCheckIn >= 4 || weeklyCheckIns < Math.max(1, Math.ceil(weeklyGoal / 2))) {
    engagementStatus = "attention";
  }

  return {
    studentId: student.id,
    weeklyCheckIns,
    monthlyCheckIns,
    attendanceRate,
    currentStreak,
    bestStreak,
    lastCheckInAt: studentCheckIns[0]?.checkedInAt ?? null,
    nextSuggestedBlockId: getNextSuggestedBlock(plan, studentCheckIns)?.id ?? null,
    weeklyGoal,
    weeklyGoalProgress: weeklyCheckIns,
    weeklyGoalAchieved: weeklyCheckIns >= weeklyGoal,
    engagementStatus,
    daysWithoutCheckIn,
    updatedAt: now.toISOString(),
  };
}

export function getEngagementTone(status: StudentEngagementStatus) {
  switch (status) {
    case "active":
      return "border-success/20 bg-success/10 text-success";
    case "attention":
      return "border-warning/20 bg-warning/10 text-warning";
    case "disengaged":
      return "border-destructive/20 bg-destructive/10 text-destructive";
  }
}

export function getEngagementLabel(status: StudentEngagementStatus) {
  switch (status) {
    case "active":
      return "Engajado";
    case "attention":
      return "Atencao";
    case "disengaged":
      return "Desengajado";
  }
}

export function getMotivationalMessage(stats: StudentEngagementStats) {
  if (stats.weeklyGoalAchieved) return "Meta semanal concluida. Excelente consistencia.";
  if (stats.currentStreak >= 4) return "Otima sequencia. Continue nesse ritmo.";
  if (stats.daysWithoutCheckIn >= 4) return `Faz ${stats.daysWithoutCheckIn} dias desde seu ultimo treino. Hora de voltar ao foco.`;
  if (stats.weeklyGoal - stats.weeklyGoalProgress === 1) return "Voce esta a um treino de bater sua meta semanal.";
  return "Seu progresso esta em andamento. Mantenha a frequencia desta semana.";
}

type CoachAlertDraft = {
  id: string;
  coachId: string;
  studentId: string;
  alertType: CoachAlertType;
  title: string;
  description: string;
};

export function buildCoachAlertDrafts(students: Student[], checkIns: StudentCheckIn[], now = new Date()): CoachAlertDraft[] {
  const drafts: CoachAlertDraft[] = [];

  students
    .filter((student) => student.studentStatus === "active")
    .forEach((student) => {
      const stats = getStudentEngagementStats(student, checkIns, now);
      if (stats.daysWithoutCheckIn >= 4) {
        drafts.push({
          id: `no-check-in:${student.id}`,
          coachId: student.coachId,
          studentId: student.id,
          alertType: "no_check_in",
          title: `${student.fullName} ha ${stats.daysWithoutCheckIn} dias sem check-in`,
          description: "Vale fazer contato e validar se o plano ainda esta aderente a rotina do aluno.",
        });
      }

      if (!stats.weeklyGoalAchieved && stats.weeklyGoal > 0 && stats.weeklyGoalProgress === 0 && stats.daysWithoutCheckIn >= 3) {
        drafts.push({
          id: `below-goal:${student.id}`,
          coachId: student.coachId,
          studentId: student.id,
          alertType: "below_goal",
          title: `${student.fullName} esta abaixo da meta semanal`,
          description: `Meta atual: ${stats.weeklyGoal} treino${stats.weeklyGoal === 1 ? "" : "s"} por semana.`,
        });
      }

      if (isWorkoutBlockedByPayment(student, now)) {
        drafts.push({
          id: `payment-blocked:${student.id}`,
          coachId: student.coachId,
          studentId: student.id,
          alertType: "payment_blocked",
          title: `${student.fullName} esta com treino bloqueado`,
          description: `Inadimplencia de ${getPaymentDaysOverdue(student, now)} dia${getPaymentDaysOverdue(student, now) === 1 ? "" : "s"}.`,
        });
      }
    });

  return drafts;
}

export function buildCoachRanking(students: Student[], checkIns: StudentCheckIn[], now = new Date()) {
  return students
    .filter((student) => student.studentStatus === "active")
    .map((student) => {
      const stats = getStudentEngagementStats(student, checkIns, now);
      const financialBlocked = isWorkoutBlockedByPayment(student, now);
      const score =
        stats.attendanceRate +
        stats.currentStreak * 8 +
        (stats.weeklyGoalAchieved ? 18 : 0) -
        stats.daysWithoutCheckIn * 4 -
        (financialBlocked ? 20 : 0);

      return {
        student,
        stats,
        financialBlocked,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);
}
