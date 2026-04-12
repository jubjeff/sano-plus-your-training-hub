import type { ProofOfPaymentStatus, Student, StudentCheckIn, StudentFinancialStatus, WorkoutBlock } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetween(date: string, now = new Date()) {
  return Math.floor((startOfDay(now).getTime() - startOfDay(new Date(date)).getTime()) / DAY_MS);
}

export function getPaymentDaysOverdue(student: Student, now = new Date()) {
  if (!student.paymentDueDate) return 0;
  return Math.max(0, daysBetween(student.paymentDueDate, now));
}

export function isWorkoutBlockedByPayment(student: Student, now = new Date()) {
  return getPaymentDaysOverdue(student, now) >= 3 && student.proofOfPaymentStatus !== "submitted";
}

export function getStudentFinancialStatus(student: Student, now = new Date()): StudentFinancialStatus {
  if (student.studentStatus === "inactive") return "inactive";

  const overdue = getPaymentDaysOverdue(student, now);

  if (student.proofOfPaymentStatus === "submitted") return "proof_submitted";
  if (overdue >= 3) return "blocked";
  if (overdue > 0) return "overdue";

  if (student.paymentDueDate) {
    const daysUntilDue = Math.ceil((startOfDay(new Date(student.paymentDueDate)).getTime() - startOfDay(now).getTime()) / DAY_MS);
    if (daysUntilDue <= 3) return "due_soon";
  }

  return "paid";
}

export function getFinancialStatusLabel(status: StudentFinancialStatus) {
  switch (status) {
    case "paid":
      return "Em dia";
    case "due_soon":
      return "Vence em breve";
    case "overdue":
      return "Atrasado";
    case "blocked":
      return "Bloqueado";
    case "proof_submitted":
      return "Comprovante enviado";
    case "inactive":
      return "Inativo";
  }
}

export function getFinancialStatusTone(status: StudentFinancialStatus) {
  switch (status) {
    case "paid":
      return "border-success/20 bg-success/10 text-success";
    case "due_soon":
      return "border-warning/20 bg-warning/10 text-warning";
    case "overdue":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300";
    case "blocked":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    case "proof_submitted":
      return "border-primary/20 bg-primary/10 text-primary";
    case "inactive":
      return "border-muted bg-muted text-muted-foreground";
  }
}

export function getProofStatusLabel(status?: ProofOfPaymentStatus | null) {
  switch (status) {
    case "submitted":
      return "Enviado";
    case "approved":
      return "Aprovado";
    default:
      return "Nao enviado";
  }
}

export function getAttendanceSummary(student: Student, checkIns: StudentCheckIn[], now = new Date()) {
  const studentCheckIns = checkIns
    .filter((checkIn) => checkIn.studentId === student.id)
    .sort((left, right) => new Date(right.checkedInAt).getTime() - new Date(left.checkedInAt).getTime());

  const weekStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)));
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

  const weeklyCount = studentCheckIns.filter((checkIn) => new Date(checkIn.checkedInAt) >= weekStart).length;
  const monthlyCount = studentCheckIns.filter((checkIn) => new Date(checkIn.checkedInAt) >= monthStart).length;

  const attendanceRate = Math.min(100, Math.round((monthlyCount / 12) * 100));

  const uniqueDays = Array.from(
    new Set(studentCheckIns.map((checkIn) => startOfDay(new Date(checkIn.checkedInAt)).toISOString())),
  ).sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  let streak = 0;
  let cursor = startOfDay(now);
  for (const day of uniqueDays) {
    const current = startOfDay(new Date(day));
    if (current.getTime() === cursor.getTime()) {
      streak += 1;
      cursor = new Date(cursor.getTime() - DAY_MS);
      continue;
    }

    if (current.getTime() === cursor.getTime() - DAY_MS && streak === 0) {
      streak += 1;
      cursor = new Date(current.getTime() - DAY_MS);
      continue;
    }

    if (current.getTime() !== cursor.getTime()) break;
  }

  return {
    total: studentCheckIns.length,
    weeklyCount,
    monthlyCount,
    attendanceRate,
    streak,
    lastCheckInAt: studentCheckIns[0]?.checkedInAt ?? null,
    recent: studentCheckIns.slice(0, 5),
  };
}

export function getActivityCalendar(student: Student, checkIns: StudentCheckIn[], days = 14, now = new Date()) {
  const studentCheckIns = checkIns.filter((checkIn) => checkIn.studentId === student.id);
  const checkedInDays = new Set(studentCheckIns.map((checkIn) => startOfDay(new Date(checkIn.checkedInAt)).toISOString()));
  const dueDate = student.paymentDueDate ? startOfDay(new Date(student.paymentDueDate)).toISOString() : null;
  const workoutChange = student.nextWorkoutChange ? startOfDay(new Date(student.nextWorkoutChange)).toISOString() : null;

  return Array.from({ length: days }, (_, index) => {
    const date = startOfDay(new Date(now.getTime() - (days - 1 - index) * DAY_MS));
    const iso = date.toISOString();

    return {
      iso,
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      shortWeekday: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      hasCheckIn: checkedInDays.has(iso),
      isPaymentDue: dueDate === iso,
      isWorkoutChange: workoutChange === iso,
      isToday: startOfDay(now).toISOString() === iso,
    };
  });
}

const WEEK_DAYS = [
  { key: "monday", label: "Segunda", shortLabel: "Seg" },
  { key: "tuesday", label: "Terca", shortLabel: "Ter" },
  { key: "wednesday", label: "Quarta", shortLabel: "Qua" },
  { key: "thursday", label: "Quinta", shortLabel: "Qui" },
  { key: "friday", label: "Sexta", shortLabel: "Sex" },
  { key: "saturday", label: "Sabado", shortLabel: "Sab" },
  { key: "sunday", label: "Domingo", shortLabel: "Dom" },
] as const;

export function getTodayWeekIndex(now = new Date()) {
  return (now.getDay() + 6) % 7;
}

export function buildWeeklyWorkoutPlan(workouts: WorkoutBlock[], now = new Date()) {
  const todayIndex = getTodayWeekIndex(now);

  return WEEK_DAYS.map((day, index) => ({
    ...day,
    order: index,
    isToday: index === todayIndex,
    block: workouts[index] ?? null,
    isRestDay: !workouts[index],
  }));
}

export function getWorkoutOfTheDay(workouts: WorkoutBlock[], now = new Date()) {
  return buildWeeklyWorkoutPlan(workouts, now).find((day) => day.isToday) ?? null;
}
