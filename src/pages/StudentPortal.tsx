import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, CreditCard, Dumbbell, Lock, ShieldCheck, UploadCloud } from "lucide-react";
import ExerciseMediaPreview from "@/components/ExerciseMediaPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { useStore } from "@/hooks/use-store";
import { formatDate, getDaysUntil } from "@/lib/format";
import { validatePaymentProofFile } from "@/lib/payment-proof";
import { getActivityCalendar, getFinancialStatusLabel, getFinancialStatusTone, getPaymentDaysOverdue, getStudentFinancialStatus, isWorkoutBlockedByPayment } from "@/lib/student-dashboard";
import { buildStudentPlanCards, getBlockDisplayLabel, getEngagementLabel, getEngagementTone, getMotivationalMessage, getPrimaryWorkoutForStudent, getStudentEngagementStats, getStudentWorkoutPlan } from "@/lib/training-management";
import type { Exercise } from "@/types";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function ExerciseCard({ studentId, blockId, exercise, onSaveLoad }: { studentId: string; blockId: string; exercise: Exercise; onSaveLoad: (studentId: string, blockId: string, exerciseId: string, value: string) => void }) {
  const [studentLoadDraft, setStudentLoadDraft] = useState(exercise.studentLoad ?? "");
  useEffect(() => setStudentLoadDraft(exercise.studentLoad ?? ""), [exercise.id, exercise.studentLoad]);
  return (
    <div className="space-y-4 rounded-[24px] border border-border/60 bg-background/60 px-4 py-4">
      <div>
        <p className="text-sm font-medium">{exercise.name}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{exercise.sets}x{exercise.reps}</span>
          {exercise.load ? <Badge variant="outline">Carga sugerida: {exercise.load}</Badge> : null}
          <Badge variant="outline">Descanso: {exercise.rest}</Badge>
        </div>
        {exercise.description ? <p className="mt-3 text-sm text-muted-foreground">{exercise.description}</p> : null}
        {exercise.notes ? <p className="mt-3 text-xs italic text-muted-foreground">Observacoes do professor: {exercise.notes}</p> : null}
      </div>
      <div className="rounded-[20px] border border-border/60 bg-muted/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Minha carga</p>
        <div className="mt-3 flex gap-2">
          <Input value={studentLoadDraft} onChange={(event) => setStudentLoadDraft(event.target.value)} onBlur={() => onSaveLoad(studentId, blockId, exercise.id, studentLoadDraft)} placeholder="Ex: 20kg por lado" className="bg-background" />
          <Button type="button" variant="outline" onClick={() => onSaveLoad(studentId, blockId, exercise.id, studentLoadDraft)}>Salvar</Button>
        </div>
      </div>
      <ExerciseMediaPreview exercise={exercise} />
    </div>
  );
}

function WorkoutBlockDetails({ studentId, block, onSaveLoad }: { studentId: string; block: ReturnType<typeof getPrimaryWorkoutForStudent>["block"]; onSaveLoad: (studentId: string, blockId: string, exerciseId: string, value: string) => void }) {
  if (!block) return null;
  return <div className="space-y-4">{block.exercises.map((exercise) => <ExerciseCard key={exercise.id} studentId={studentId} blockId={block.id} exercise={exercise} onSaveLoad={onSaveLoad} />)}</div>;
}

export default function StudentPortal() {
  const { user } = useAuth();
  const { getStudentByUserId, getStudentCheckIns, submitProofOfPayment, registerStudentCheckIn, updateStudentExerciseLoad } = useStore();
  const student = getStudentByUserId(user?.id);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);

  const checkIns = useMemo(() => (student ? getStudentCheckIns(student.id) : []), [getStudentCheckIns, student]);
  const plan = useMemo(() => (student ? getStudentWorkoutPlan(student) : null), [student]);
  const engagement = useMemo(() => (student ? getStudentEngagementStats(student, checkIns) : null), [checkIns, student]);
  const financialStatus = useMemo(() => (student ? getStudentFinancialStatus(student) : "inactive"), [student]);
  const daysOverdue = useMemo(() => (student ? getPaymentDaysOverdue(student) : 0), [student]);
  const workoutBlocked = useMemo(() => (student ? isWorkoutBlockedByPayment(student) : false), [student]);
  const calendarDays = useMemo(() => (student ? getActivityCalendar(student, checkIns, 14) : []), [checkIns, student]);
  const cards = useMemo(() => (student ? buildStudentPlanCards(student, checkIns) : []), [checkIns, student]);
  const primaryWorkout = useMemo(() => (student ? getPrimaryWorkoutForStudent(student, checkIns) : null), [checkIns, student]);
  const selectedCard = useMemo(() => cards.find((card) => card.key === selectedCardKey) ?? null, [cards, selectedCardKey]);
  const hasCheckInToday = useMemo(() => checkIns.some((checkIn) => new Date(checkIn.checkedInAt).toDateString() === new Date().toDateString() && checkIn.workoutBlockId === primaryWorkout?.block?.id), [checkIns, primaryWorkout?.block?.id]);

  if (!student || !plan || !engagement || !primaryWorkout) {
    return <div className="section-shell py-16 text-center"><p className="text-muted-foreground">Seu perfil de aluno ainda nao esta vinculado a uma conta ativa.</p></div>;
  }

  const nextWorkoutDays = getDaysUntil(plan.nextWorkoutChangeDate ?? student.nextWorkoutChange);
  const statusTone = getFinancialStatusTone(financialStatus);
  const statusLabel = getFinancialStatusLabel(financialStatus);
  const trainingModeLabel = primaryWorkout.mode === "today" ? "Treino do dia" : "Proximo treino";
  const nextEvent = workoutBlocked ? "Regularize o pagamento para liberar os treinos." : nextWorkoutDays === null ? "Sem proxima troca agendada." : nextWorkoutDays <= 0 ? "Seu treino pode ser atualizado hoje." : `Sua proxima troca de treino acontece em ${nextWorkoutDays} dia${nextWorkoutDays === 1 ? "" : "s"}.`;

  const handleProofSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validatePaymentProofFile(file);
    if (validationError) {
      toast.error(validationError);
      event.target.value = "";
      return;
    }
    setIsSubmittingProof(true);
    try {
      await submitProofOfPayment(student.id, file);
      toast.success("Comprovante enviado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar o comprovante.");
    } finally {
      setIsSubmittingProof(false);
      event.target.value = "";
    }
  };

  const handleCheckIn = async () => {
    if (!primaryWorkout.block) return;
    setIsCheckingIn(true);
    try {
      registerStudentCheckIn(student.id, primaryWorkout.block.id, "student");
      toast.success("Check-in registrado. Bom treino.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel registrar o check-in.");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSaveLoad = (studentId: string, blockId: string, exerciseId: string, value: string) => {
    updateStudentExerciseLoad(studentId, blockId, exerciseId, value);
    toast.success("Carga pessoal atualizada.");
  };

  return (
    <div className="page-shell">
      <input ref={fileInputRef} type="file" accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={handleProofSelected} />

      <section className="section-shell overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
          <div>
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Dashboard do aluno</span>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">{getGreeting()}, {student.fullName.split(" ")[0]}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Seu painel destaca o treino principal e o progresso de adesao da semana.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge className={statusTone}>{statusLabel}</Badge>
              <Badge variant="outline">{plan.trainingStructureType === "weekly" ? "Weekly" : "ABCDE"}</Badge>
              <Badge variant="outline">{plan.trainingProgressMode === "fixed_schedule" ? "Fixo por dia" : "Sequencial por conclusao"}</Badge>
              <Badge variant="outline">Frequencia {engagement.attendanceRate}%</Badge>
            </div>
          </div>
          <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Status geral</p>
            <p className="mt-3 text-2xl font-semibold">{primaryWorkout.block?.name ?? "Sem treino programado"}</p>
            <p className="mt-2 text-sm text-muted-foreground">{nextEvent}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-3"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Treino principal</p><p className="mt-2 font-medium">{workoutBlocked ? "Bloqueado" : primaryWorkout.block ? trainingModeLabel : "Descanso"}</p></div>
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-3"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Check-ins do mes</p><p className="mt-2 font-medium">{engagement.monthlyCheckIns}</p></div>
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <div className="flex justify-start overflow-x-auto pb-1"><TabsList className="h-auto rounded-[18px] border border-border/60 bg-background/70 p-1"><TabsTrigger value="dashboard" className="rounded-[14px] px-4 py-2">Dashboard</TabsTrigger><TabsTrigger value="treinos" className="rounded-[14px] px-4 py-2">Treinos</TabsTrigger></TabsList></div>

        <TabsContent value="dashboard" className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="section-shell p-6">
              <div className="mb-5 flex items-center gap-2"><Dumbbell className="h-5 w-5 text-primary" /><div><h2 className="font-display text-xl font-semibold">{trainingModeLabel}</h2><p className="text-sm text-muted-foreground">{primaryWorkout.label}{student.workoutUpdatedAt ? ` • atualizado em ${formatDate(student.workoutUpdatedAt)}` : ""}</p></div></div>
              <div className={`rounded-[24px] border p-5 ${workoutBlocked ? "border-destructive/30 bg-destructive/5" : "border-border/60 bg-background/70"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-lg font-semibold">{primaryWorkout.block?.name ?? "Descanso ou sem treino programado"}</p><p className="mt-1 text-sm text-muted-foreground">{workoutBlocked ? `Seu pagamento esta atrasado ha ${daysOverdue} dia${daysOverdue === 1 ? "" : "s"}. Regularize ou envie o comprovante para voltar a treinar.` : primaryWorkout.contextualMessage}</p></div>
                  <Badge className={workoutBlocked ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-success/20 bg-success/10 text-success"}>{workoutBlocked ? "Bloqueado" : primaryWorkout.block ? "Liberado" : "Descanso"}</Badge>
                </div>
                {primaryWorkout.block && !workoutBlocked ? (
                  <>
                    <div className="mt-5 rounded-[22px] border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">{primaryWorkout.block.exercises.length} exercicio{primaryWorkout.block.exercises.length === 1 ? "" : "s"} planejado{primaryWorkout.block.exercises.length === 1 ? "" : "s"} para este bloco.</div>
                    {primaryWorkout.mode === "next" ? <div className="mt-4 rounded-[22px] border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">{primaryWorkout.lastCompletedBlock ? `Ultimo treino realizado: ${getBlockDisplayLabel(primaryWorkout.lastCompletedBlock, plan)}.` : "Nenhum treino concluido ainda neste plano."}{primaryWorkout.nextBlock ? ` Depois deste bloco, o proximo sugerido sera ${getBlockDisplayLabel(primaryWorkout.nextBlock, plan)}.` : ""}</div> : null}
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button onClick={handleCheckIn} disabled={isCheckingIn || hasCheckInToday}><CheckCircle2 className="mr-2 h-4 w-4" />{hasCheckInToday ? "Check-in de hoje registrado" : isCheckingIn ? "Registrando..." : "Fazer check-in"}</Button>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmittingProof}><UploadCloud className="mr-2 h-4 w-4" />{isSubmittingProof ? "Enviando..." : "Enviar comprovante"}</Button>
                    </div>
                    <div className="mt-5"><WorkoutBlockDetails studentId={student.id} block={primaryWorkout.block} onSaveLoad={handleSaveLoad} /></div>
                  </>
                ) : workoutBlocked ? (
                  <div className="mt-5 rounded-[22px] border border-destructive/30 bg-background/80 p-5 text-center"><Lock className="mx-auto h-8 w-8 text-destructive" /><p className="mt-3 font-medium">Treino bloqueado por inadimplencia</p><p className="mt-2 text-sm text-muted-foreground">O dashboard continua disponivel, mas os detalhes do treino ficam ocultos ate a regularizacao.</p><Button className="mt-4" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmittingProof}><UploadCloud className="mr-2 h-4 w-4" />{isSubmittingProof ? "Enviando..." : "Enviar comprovante"}</Button></div>
                ) : <div className="mt-5 rounded-[22px] border border-dashed border-border/60 p-8 text-center text-muted-foreground">Nao ha treino configurado para este momento. Use a aba Treinos para consultar o plano completo.</div>}
              </div>
            </div>

            <div className="space-y-6">
              <section className="section-shell p-6">
                <div className="mb-5 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><div><h2 className="font-display text-xl font-semibold">Meta e consistencia</h2><p className="text-sm text-muted-foreground">Seu progresso da semana e ritmo de adesao.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-border/60 bg-background/70 p-4"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Meta semanal</p><p className="mt-2 text-3xl font-semibold">{engagement.weeklyGoalProgress}/{engagement.weeklyGoal}</p><Progress value={Math.min(100, Math.round((engagement.weeklyGoalProgress / Math.max(engagement.weeklyGoal, 1)) * 100))} className="mt-4" /><p className="mt-3 text-sm text-muted-foreground">{engagement.weeklyGoalAchieved ? "Meta semanal concluida." : `Faltam ${Math.max(engagement.weeklyGoal - engagement.weeklyGoalProgress, 0)} treino${Math.max(engagement.weeklyGoal - engagement.weeklyGoalProgress, 0) === 1 ? "" : "s"} para concluir a meta.`}</p></div>
                  <div className="rounded-[24px] border border-border/60 bg-background/70 p-4"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Streak atual</p><p className="mt-2 text-3xl font-semibold">{engagement.currentStreak} dia{engagement.currentStreak === 1 ? "" : "s"}</p><p className="mt-3 text-sm text-muted-foreground">Melhor streak: {engagement.bestStreak}</p></div>
                </div>
                <div className="mt-4 rounded-[24px] border border-border/60 bg-background/70 p-4"><div className="flex flex-wrap items-center gap-2"><Badge className={getEngagementTone(engagement.engagementStatus)}>{getEngagementLabel(engagement.engagementStatus)}</Badge><Badge variant="outline">Semana {engagement.weeklyCheckIns}</Badge><Badge variant="outline">Mes {engagement.monthlyCheckIns}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{getMotivationalMessage(engagement)}</p></div>
              </section>

              <section className="section-shell p-6">
                <div className="mb-5 flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><div><h2 className="font-display text-xl font-semibold">Financeiro</h2><p className="text-sm text-muted-foreground">Seu acesso respeita a regra de inadimplencia do plano.</p></div></div>
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-border/60 bg-background/70 p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Status do pagamento</p><Badge className={statusTone}>{statusLabel}</Badge></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vencimento</p><p className="mt-2 font-medium">{student.paymentDueDate ? formatDate(student.paymentDueDate) : "Sem data"}</p></div><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ultimo pagamento</p><p className="mt-2 font-medium">{student.paymentLastPaidAt ? formatDate(student.paymentLastPaidAt) : "Nao registrado"}</p></div><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dias de atraso</p><p className="mt-2 font-medium">{daysOverdue}</p></div><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Comprovante</p><p className="mt-2 font-medium">{student.proofOfPaymentStatus === "submitted" ? "Enviado para analise" : student.proofOfPaymentStatus === "approved" ? "Aprovado" : "Nao enviado"}</p></div></div>{student.proofOfPaymentSentAt ? <p className="mt-4 text-xs text-muted-foreground">Ultimo comprovante enviado em {formatDate(student.proofOfPaymentSentAt)}.</p> : null}</div>
                  <div className="rounded-[24px] border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">{daysOverdue >= 3 && student.proofOfPaymentStatus !== "submitted" ? "Com 3 dias ou mais de atraso, os treinos e check-ins ficam bloqueados automaticamente." : student.proofOfPaymentStatus === "submitted" ? "Seu comprovante foi enviado e esta aguardando analise do professor." : "Se precisar, envie o comprovante por este painel para agilizar a regularizacao."}</div>
                </div>
              </section>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="treinos" className="space-y-6">
          <section className="section-shell p-6 lg:p-8">
            <div className="mb-6 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /><div><h2 className="font-display text-xl font-semibold">Treinos</h2><p className="text-sm text-muted-foreground">{plan.trainingStructureType === "weekly" ? "Visao completa dos treinos por dia da semana." : "Visao completa da sua sequencia de blocos ABCDE."}</p></div></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <button key={card.key} type="button" onClick={() => setSelectedCardKey(card.key)} className={`rounded-[24px] border p-5 text-left transition-colors hover:border-primary/30 ${card.isCurrent ? "border-primary/30 bg-primary/5" : workoutBlocked ? "border-destructive/20 bg-destructive/5" : "border-border/60 bg-background/70"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{card.label}</p><h3 className="mt-2 text-lg font-semibold">{card.block?.name ?? "Descanso"}</h3></div>
                    <div className="flex flex-col items-end gap-2">{card.isCurrent ? <Badge className="border-primary/20 bg-primary/10 text-primary">{primaryWorkout.mode === "today" ? "Atual" : "Proximo"}</Badge> : null}{card.isRecentlyCompleted ? <Badge variant="outline">Feito recente</Badge> : null}<Badge className={workoutBlocked ? "border-destructive/20 bg-destructive/10 text-destructive" : card.block ? "border-success/20 bg-success/10 text-success" : "border-muted bg-muted text-muted-foreground"}>{workoutBlocked ? "Bloqueado" : card.block ? "Disponivel" : "Descanso"}</Badge></div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{workoutBlocked ? `Treino bloqueado por inadimplencia (${daysOverdue} dia${daysOverdue === 1 ? "" : "s"} de atraso).` : card.block ? `${card.block.exercises.length} exercicio${card.block.exercises.length === 1 ? "" : "s"} planejado${card.block.exercises.length === 1 ? "" : "s"} para ${card.label.toLowerCase()}.` : "Sem treino programado para este bloco."}</p>
                  {workoutBlocked ? <div className="mt-4 rounded-[18px] border border-destructive/20 bg-background/80 p-4 text-sm text-muted-foreground">Clique para ver os detalhes do bloqueio.</div> : card.block ? <div className="mt-4 space-y-2">{card.block.exercises.slice(0, 2).map((exercise) => <div key={exercise.id} className="rounded-[18px] border border-border/60 bg-muted/30 px-3 py-2 text-sm"><p className="font-medium">{exercise.name}</p><p className="text-xs text-muted-foreground">{exercise.sets}x{exercise.reps} • Descanso {exercise.rest}</p></div>)}{card.block.exercises.length > 2 ? <p className="text-xs text-muted-foreground">+ {card.block.exercises.length - 2} exercicio{card.block.exercises.length - 2 === 1 ? "" : "s"}</p> : null}</div> : <div className="mt-4 rounded-[18px] border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">Clique para ver o status deste bloco.</div>}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="section-shell p-6"><div className="mb-5 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><div><h2 className="font-display text-xl font-semibold">Check-ins recentes</h2><p className="text-sm text-muted-foreground">Seu historico mais recente continua visivel aqui.</p></div></div><div className="space-y-3">{checkIns.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum treino registrado ainda.</p> : checkIns.slice(0, 5).map((checkIn) => <div key={checkIn.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm"><span>{formatDate(checkIn.checkedInAt)}</span><span className="text-muted-foreground">{checkIn.blockLabel ?? (checkIn.source === "student" ? "Check-in do aluno" : "Lancado pelo professor")}</span></div>)}</div></div>
            <div className="section-shell p-6"><div className="mb-5 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /><div><h2 className="font-display text-xl font-semibold">Resumo visual</h2><p className="text-sm text-muted-foreground">Calendario rapido com treinos, vencimento e troca de treino.</p></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">{calendarDays.map((day) => <div key={day.iso} className={`rounded-[22px] border p-3 text-center ${day.isToday ? "border-primary/30 bg-primary/10" : "border-border/60 bg-background/70"}`}><p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{day.shortWeekday}</p><p className="mt-2 text-sm font-semibold">{day.label}</p><div className="mt-3 flex items-center justify-center gap-1.5">{day.hasCheckIn ? <span className="h-2.5 w-2.5 rounded-full bg-success" title="Check-in" /> : <span className="h-2.5 w-2.5 rounded-full bg-muted" />}{day.isPaymentDue ? <span className="h-2.5 w-2.5 rounded-full bg-warning" title="Vencimento" /> : null}{day.isWorkoutChange ? <span className="h-2.5 w-2.5 rounded-full bg-primary" title="Troca de treino" /> : null}</div></div>)}</div></div>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={selectedCard !== null} onOpenChange={(open) => !open && setSelectedCardKey(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{selectedCard?.label}{selectedCard?.isCurrent ? " • Atual" : ""}</DialogTitle>
            <DialogDescription>{workoutBlocked ? "Seu acesso aos detalhes do treino esta bloqueado por inadimplencia." : selectedCard?.block ? `Veja os detalhes completos de ${selectedCard.block.name}.` : "Nao ha treino programado para este bloco."}</DialogDescription>
          </DialogHeader>
          <DialogBody>
          {selectedCard ? (
            workoutBlocked ? <div className="rounded-[24px] border border-destructive/20 bg-destructive/5 p-5 text-sm text-muted-foreground">O pagamento esta atrasado ha {daysOverdue} dia{daysOverdue === 1 ? "" : "s"}. Regularize com o professor ou envie um comprovante para liberar os detalhes dos treinos.</div> : selectedCard.block ? <WorkoutBlockDetails studentId={student.id} block={selectedCard.block} onSaveLoad={handleSaveLoad} /> : <div className="rounded-[24px] border border-dashed border-border/60 p-8 text-center text-muted-foreground">Descanso ou recuperacao programada para este bloco.</div>
          ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
