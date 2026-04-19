import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Download, Dumbbell, Edit, KeyRound, Mail, Phone, Plus, ReceiptText, ShieldCheck, Trash2, UserCheck, UserMinus } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import type { StudentTemporaryAccessResult } from "@/integrations/supabase/function-contracts";
import type { Exercise, WorkoutBlock } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ExerciseEditorDialog from "@/components/ExerciseEditorDialog";
import ExerciseLibraryPickerDialog from "@/components/ExerciseLibraryPickerDialog";
import ExerciseMediaPreview from "@/components/ExerciseMediaPreview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImportWorkoutDialog from "@/components/ImportWorkoutDialog";
import StudentFormDialog from "@/components/StudentFormDialog";
import StudentTemporaryPasswordDialog from "@/components/StudentTemporaryPasswordDialog";
import { formatDate, getInitials, getRelativeWorkoutLabel } from "@/lib/format";
import { getStudentAccessStatusLabel, getStudentAccessTone } from "@/lib/student-access";
import { getAttendanceSummary, getFinancialStatusLabel, getFinancialStatusTone, getPaymentDaysOverdue, getProofStatusLabel, getStudentFinancialStatus, isWorkoutBlockedByPayment } from "@/lib/student-dashboard";
import { getAllowedProgressModes, getEngagementLabel, getEngagementTone, getPrimaryWorkoutForStudent, getStudentEngagementStats, getStudentWorkoutPlan, normalizeProgressMode } from "@/lib/training-management";
import { teacherAdminActionsService } from "@/services/teacher-admin-actions.service";
import { toast } from "@/components/ui/sonner";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { students, checkIns, updateStudent, setStudentLifecycle, getStudentCheckIns, approveProofOfPayment, markPaymentReceived, updatePaymentDueDate, refresh } = useStore();
  const student = students.find((item) => item.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [temporaryAccess, setTemporaryAccess] = useState<StudentTemporaryAccessResult | null>(null);
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutBlock[]>([]);
  const [trainingStructureDraft, setTrainingStructureDraft] = useState<"weekly" | "abcde">("weekly");
  const [trainingProgressDraft, setTrainingProgressDraft] = useState<"fixed_schedule" | "sequential_progression">("fixed_schedule");
  const [weeklyGoalDraft, setWeeklyGoalDraft] = useState(4);
  const [currentSuggestedBlockIdDraft, setCurrentSuggestedBlockIdDraft] = useState<string | null>(null);
  const [pickerBlockId, setPickerBlockId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ blockId: string; exerciseId?: string } | null>(null);
  const [paymentDueDateDraft, setPaymentDueDateDraft] = useState("");

  const editingExercise = useMemo(() => {
    if (!editorState?.exerciseId) return undefined;
    return workoutDraft
      .find((block) => block.id === editorState.blockId)
      ?.exercises.find((exercise) => exercise.id === editorState.exerciseId);
  }, [editorState, workoutDraft]);

  const studentCheckIns = useMemo(() => (student ? getStudentCheckIns(student.id) : []), [getStudentCheckIns, student]);
  const attendance = useMemo(() => (student ? getAttendanceSummary(student, studentCheckIns) : null), [student, studentCheckIns]);
  const workoutPlan = useMemo(() => (student ? getStudentWorkoutPlan(student) : null), [student]);
  const engagement = useMemo(() => (student ? getStudentEngagementStats(student, studentCheckIns) : null), [student, studentCheckIns]);
  const primaryWorkout = useMemo(() => (student ? getPrimaryWorkoutForStudent(student, studentCheckIns) : null), [student, studentCheckIns]);
  const financialStatus = useMemo(() => (student ? getStudentFinancialStatus(student) : "inactive"), [student]);
  const daysOverdue = useMemo(() => (student ? getPaymentDaysOverdue(student) : 0), [student]);
  const workoutBlocked = useMemo(() => (student ? isWorkoutBlockedByPayment(student) : false), [student]);

  useEffect(() => {
    setPaymentDueDateDraft(student?.paymentDueDate ?? "");
  }, [student?.paymentDueDate]);

  useEffect(() => {
    if (!workoutPlan) return;
    setTrainingStructureDraft(workoutPlan.trainingStructureType);
    setTrainingProgressDraft(workoutPlan.trainingProgressMode);
    setWeeklyGoalDraft(workoutPlan.weeklyGoal ?? 4);
    setCurrentSuggestedBlockIdDraft(workoutPlan.currentSuggestedBlockId ?? null);
  }, [workoutPlan]);

  if (!student) {
    return (
      <div className="section-shell py-16 text-center">
        <p className="text-muted-foreground">Aluno não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/alunos")}>Voltar</Button>
      </div>
    );
  }

  const startEditWorkout = () => {
    const plan = getStudentWorkoutPlan(student);
    setWorkoutDraft(JSON.parse(JSON.stringify(plan.blocks)));
    setTrainingStructureDraft(plan.trainingStructureType);
    setTrainingProgressDraft(plan.trainingProgressMode);
    setWeeklyGoalDraft(plan.weeklyGoal ?? 4);
    setCurrentSuggestedBlockIdDraft(plan.currentSuggestedBlockId ?? null);
    setEditingWorkout(true);
  };

  const saveWorkout = async () => {
    const timestamp = new Date().toISOString().split("T")[0];
    const normalizedProgress = normalizeProgressMode(trainingStructureDraft, trainingProgressDraft);
    const currentPlan = getStudentWorkoutPlan(student);
    await updateStudent(student.id, {
      workout: workoutDraft,
      workoutUpdatedAt: timestamp,
      workoutPlan: {
        ...currentPlan,
        trainingStructureType: trainingStructureDraft,
        trainingProgressMode: normalizedProgress,
        weeklyGoal: weeklyGoalDraft,
        currentSuggestedBlockId: normalizedProgress === "sequential_progression" ? currentSuggestedBlockIdDraft : null,
        blocks: workoutDraft.map((block, index) => ({
          ...block,
          orderIndex: index,
          dayOfWeek: trainingStructureDraft === "weekly" ? index : null,
          letterLabel: trainingStructureDraft === "abcde" ? String.fromCharCode(65 + index) : null,
          blockLabel: trainingStructureDraft === "weekly" ? ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"][index] ?? block.name : String.fromCharCode(65 + index),
        })),
        nextWorkoutChangeDate: student.nextWorkoutChange ?? currentPlan.nextWorkoutChangeDate ?? null,
        updatedAt: timestamp,
      },
    });
    setEditingWorkout(false);
  };

  const addBlock = () => {
    const letter = String.fromCharCode(65 + workoutDraft.length);
    setWorkoutDraft((current) => [...current, { id: generateId(), name: `Treino ${letter}`, exercises: [], orderIndex: current.length }]);
  };

  const removeBlock = (blockId: string) => {
    setWorkoutDraft((current) => current.filter((block) => block.id !== blockId));
  };

  const updateBlock = (blockId: string, name: string) => {
    setWorkoutDraft((current) => current.map((block) => (block.id === blockId ? { ...block, name } : block)));
  };

  const addExerciseToBlock = (blockId: string, exercise: Exercise) => {
    setWorkoutDraft((current) =>
      current.map((block) => (block.id === blockId ? { ...block, exercises: [...block.exercises, exercise] } : block)),
    );
  };

  const removeExercise = (blockId: string, exerciseId: string) => {
    setWorkoutDraft((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, exercises: block.exercises.filter((exercise) => exercise.id !== exerciseId) } : block,
      ),
    );
  };

  const updateExercise = (blockId: string, exerciseId: string, data: Partial<Exercise>) => {
    setWorkoutDraft((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, exercises: block.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...data } : exercise)) }
          : block,
      ),
    );
  };

  const saveExercise = (exercise: Exercise) => {
    if (!editorState) return;

    setWorkoutDraft((current) =>
      current.map((block) => {
        if (block.id !== editorState.blockId) return block;
        if (!editorState.exerciseId) {
          return { ...block, exercises: [...block.exercises, exercise] };
        }
        return {
          ...block,
          exercises: block.exercises.map((item) => (item.id === editorState.exerciseId ? exercise : item)),
        };
      }),
    );
    setEditorState(null);
  };

  const handleTemporaryAccess = async () => {
    const result = await teacherAdminActionsService.resetStudentTemporaryAccess(student.id);
    await refresh?.();
    setTemporaryAccess(result);
    if (result.emailDelivery?.status === "sent") {
      toast.success("Nova senha provisória enviada ao aluno por e-mail.");
    } else if (result.emailDelivery?.status === "failed") {
      toast.error("A senha provisória foi atualizada, mas o envio automático do e-mail falhou.");
    } else if (result.emailDelivery?.status === "skipped") {
      toast.message(result.emailDelivery.message);
    }
  };

  const handleLifecycleToggle = async () => {
    const nextActive = student.studentStatus !== "active";
    await setStudentLifecycle(student.id, nextActive);
  };

  const handleUpdateDueDate = async () => {
    if (!paymentDueDateDraft) return;
    await updatePaymentDueDate(student.id, paymentDueDateDraft);
  };

  const handleManualPayment = async () => {
    await markPaymentReceived(student.id);
  };

  const handleApproveProof = async () => {
    await approveProofOfPayment(student.id);
  };

  const workout = editingWorkout ? workoutDraft : student.workout;

  return (
    <div className="page-shell">
      <button onClick={() => navigate("/alunos")} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar para alunos
      </button>

      <section className="section-shell overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-primary/12 text-2xl font-bold text-primary">{getInitials(student.fullName)}</div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold tracking-tight">{student.fullName}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStudentAccessTone(student.accessStatus)}`}>{getStudentAccessStatusLabel(student.accessStatus)}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{student.goal}</p>
              <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />{student.email || "Sem e-mail"}</span>
                <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{student.phone || "Sem telefone"}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />Nascimento: {formatDate(student.birthDate)}</span>
              </div>
              {student.notes && <p className="mt-4 max-w-2xl rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">{student.notes}</p>}
            </div>
          </div>

          <div className="rounded-[24px] border border-border/60 bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Conta e acesso</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="outline">Aluno</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status do cadastro</span>
                <Badge variant="outline">{student.studentStatus === "active" ? "Ativo" : "Inativo"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status do acesso</span>
                <Badge className={getStudentAccessTone(student.accessStatus)}>{getStudentAccessStatusLabel(student.accessStatus)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Senha provisória gerada em</span>
                <span>{student.temporaryPasswordGeneratedAt ? formatDate(student.temporaryPasswordGeneratedAt) : "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Primeiro acesso concluido em</span>
                <span>{student.firstAccessCompletedAt ? formatDate(student.firstAccessCompletedAt) : "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ultimo login</span>
                <span>{student.lastLoginAt ? formatDate(student.lastLoginAt) : "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ultimo check-in</span>
                <span>{student.lastCheckInAt ? formatDate(student.lastCheckInAt) : "-"}</span>
              </div>
            </div>

              <div className="mt-5 flex flex-col gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar aluno
              </Button>

              {student.accessStatus === "inactive" ? (
                <Button variant="outline" onClick={handleTemporaryAccess}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Gerar novo acesso
                </Button>
              ) : null}

              {student.accessStatus === "temporary_password_pending" ? (
                <Button variant="outline" onClick={handleTemporaryAccess}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Regenerar senha provisória
                </Button>
              ) : null}

              {student.accessStatus === "active" ? (
                <Button variant="outline" onClick={handleTemporaryAccess}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Resetar acesso
                </Button>
              ) : null}

              <Button variant="outline" onClick={handleLifecycleToggle}>
                {student.studentStatus === "active" ? <UserMinus className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
                {student.studentStatus === "active" ? "Inativar aluno" : "Reativar aluno"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="section-shell p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">Dados pessoais e esportivos</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Dados pessoais</p>
              <div className="mt-3 space-y-2 text-sm">
                <p><span className="text-muted-foreground">Nome:</span> {student.fullName}</p>
                <p><span className="text-muted-foreground">E-mail:</span> {student.email}</p>
                <p><span className="text-muted-foreground">Telefone:</span> {student.phone || "Sem telefone"}</p>
                <p><span className="text-muted-foreground">Nascimento:</span> {formatDate(student.birthDate)}</p>
              </div>
            </div>
            <div className="rounded-[22px] border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Dados esportivos</p>
              <div className="mt-3 space-y-2 text-sm">
                <p><span className="text-muted-foreground">Objetivo:</span> {student.goal}</p>
                <p><span className="text-muted-foreground">Observações:</span> {student.notes || "Sem observações"}</p>
                <p><span className="text-muted-foreground">Início:</span> {formatDate(student.startDate)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="section-shell p-6">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Financeiro e bloqueio</p>
              <p className="mt-1 text-2xl font-semibold">{getFinancialStatusLabel(financialStatus)}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status financeiro</span>
              <Badge className={getFinancialStatusTone(financialStatus)}>{getFinancialStatusLabel(financialStatus)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vencimento</span>
              <span>{student.paymentDueDate ? formatDate(student.paymentDueDate) : "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dias de atraso</span>
              <span>{daysOverdue}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ultimo pagamento</span>
              <span>{student.paymentLastPaidAt ? formatDate(student.paymentLastPaidAt) : "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Comprovante</span>
              <span>{getProofStatusLabel(student.proofOfPaymentStatus)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Treino</span>
              <Badge className={workoutBlocked ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-success/20 bg-success/10 text-success"}>
                {workoutBlocked ? "Bloqueado" : "Liberado"}
              </Badge>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <Label className="text-xs">Ajustar vencimento</Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input type="date" value={paymentDueDateDraft} onChange={(event) => setPaymentDueDateDraft(event.target.value)} className="bg-card" />
                <Button variant="outline" onClick={handleUpdateDueDate}>Salvar</Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={handleManualPayment}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Registrar pagamento
              </Button>
              {student.proofOfPaymentStatus === "submitted" ? (
                <Button variant="outline" onClick={handleApproveProof}>
                  <ReceiptText className="mr-2 h-4 w-4" />
                  Aprovar comprovante
                </Button>
              ) : null}
              {student.proofOfPaymentFileName ? (
                <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Arquivo enviado: <span className="font-medium text-foreground">{student.proofOfPaymentFileName}</span>
                  {student.proofOfPaymentSentAt ? ` em ${formatDate(student.proofOfPaymentSentAt)}` : ""}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="section-shell p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">Frequencia</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[22px] border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">No mes</p>
              <p className="mt-2 text-3xl font-semibold">{attendance?.attendanceRate ?? 0}%</p>
              <p className="mt-2 text-sm text-muted-foreground">{attendance?.monthlyCount ?? 0} check-ins</p>
            </div>
            <div className="rounded-[22px] border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sequencia atual</p>
              <p className="mt-2 text-3xl font-semibold">{attendance?.streak ?? 0}</p>
              <p className="mt-2 text-sm text-muted-foreground">Semana: {attendance?.weeklyCount ?? 0}</p>
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-border/60 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Check-ins recentes</p>
            <div className="mt-3 space-y-2 text-sm">
              {studentCheckIns.length === 0 ? (
                <p className="text-muted-foreground">Nenhum check-in registrado ainda.</p>
              ) : (
                studentCheckIns.slice(0, 5).map((checkIn) => (
                  <div key={checkIn.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-3 py-2">
                    <span>{formatDate(checkIn.checkedInAt)}</span>
                    <span className="text-muted-foreground">{checkIn.source === "student" ? "Aluno" : "Professor"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="section-shell p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Plano e engajamento</p>
          <p className="mt-3 text-2xl font-semibold">{primaryWorkout?.title ?? getRelativeWorkoutLabel(student.nextWorkoutChange)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {workoutPlan
              ? `${workoutPlan.trainingStructureType === "weekly" ? "Weekly" : "ABCDE"} • ${workoutPlan.trainingProgressMode === "fixed_schedule" ? "Fixo por dia" : "Sequencial por conclusao"}`
              : "Sem plano configurado"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {engagement ? <Badge className={getEngagementTone(engagement.engagementStatus)}>{getEngagementLabel(engagement.engagementStatus)}</Badge> : null}
            {workoutPlan ? <Badge variant="outline">Meta semanal {workoutPlan.weeklyGoal ?? 4}</Badge> : null}
            {workoutBlocked ? <Badge className="border-destructive/20 bg-destructive/10 text-destructive">Treino bloqueado</Badge> : null}
          </div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-[20px] border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progresso da meta</p>
              <p className="mt-2 text-xl font-semibold">{engagement?.weeklyGoalProgress ?? 0}/{engagement?.weeklyGoal ?? 0}</p>
            </div>
            <div className="rounded-[20px] border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dias sem check-in</p>
              <p className="mt-2 text-xl font-semibold">{engagement?.daysWithoutCheckIn ?? 0}</p>
            </div>
            <div className="rounded-[20px] border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Melhor streak</p>
              <p className="mt-2 text-xl font-semibold">{engagement?.bestStreak ?? 0}</p>
            </div>
            <div className="rounded-[20px] border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proxima troca</p>
              <p className="mt-2 text-xl font-semibold">{getRelativeWorkoutLabel(workoutPlan?.nextWorkoutChangeDate ?? student.nextWorkoutChange)}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Importar treino
            </Button>
            <Button onClick={startEditWorkout}>
              <Edit className="mr-2 h-4 w-4" />
              Editar treino
            </Button>
          </div>
        </div>
      </section>

      <section className="section-shell p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-display text-xl font-semibold">Treino atual</h2>
              {student.workoutUpdatedAt && <p className="text-sm text-muted-foreground">Atualizado em {formatDate(student.workoutUpdatedAt)}</p>}
            </div>
          </div>
          <div className="page-actions">
            <Button variant="outline" onClick={() => setImportOpen(true)}><Download className="mr-2 h-4 w-4" />Importar treino</Button>
            {editingWorkout ? (
              <>
                <Button variant="outline" onClick={() => setEditingWorkout(false)}>Cancelar</Button>
                <Button onClick={saveWorkout}>Salvar treino</Button>
              </>
            ) : (
              <Button onClick={startEditWorkout}><Edit className="mr-2 h-4 w-4" />Editar treino</Button>
            )}
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-4">
          <div className="rounded-[20px] border border-border/60 bg-background/70 p-4">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estrutura</Label>
            {editingWorkout ? (
              <select
                value={trainingStructureDraft}
                onChange={(event) => {
                  const nextStructure = event.target.value as "weekly" | "abcde";
                  setTrainingStructureDraft(nextStructure);
                  setTrainingProgressDraft((current) => normalizeProgressMode(nextStructure, current));
                }}
                className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="weekly">Weekly</option>
                <option value="abcde">ABCDE</option>
              </select>
            ) : (
              <p className="mt-3 text-sm font-medium">{workoutPlan?.trainingStructureType === "weekly" ? "Weekly" : "ABCDE"}</p>
            )}
          </div>
          <div className="rounded-[20px] border border-border/60 bg-background/70 p-4">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progressao</Label>
            {editingWorkout ? (
              <select
                value={trainingProgressDraft}
                onChange={(event) => setTrainingProgressDraft(event.target.value as "fixed_schedule" | "sequential_progression")}
                className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {getAllowedProgressModes(trainingStructureDraft).map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === "fixed_schedule" ? "Fixo por dia" : "Sequencial por conclusao"}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-3 text-sm font-medium">{workoutPlan?.trainingProgressMode === "fixed_schedule" ? "Fixo por dia" : "Sequencial por conclusao"}</p>
            )}
          </div>
          <div className="rounded-[20px] border border-border/60 bg-background/70 p-4">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Meta semanal</Label>
            {editingWorkout ? (
              <Input className="mt-3 h-10 bg-card" type="number" min={1} max={7} value={weeklyGoalDraft} onChange={(event) => setWeeklyGoalDraft(Number(event.target.value) || 1)} />
            ) : (
              <p className="mt-3 text-sm font-medium">{workoutPlan?.weeklyGoal ?? 4} treinos</p>
            )}
          </div>
          <div className="rounded-[20px] border border-border/60 bg-background/70 p-4">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proximo sugerido</Label>
            {editingWorkout && trainingProgressDraft === "sequential_progression" ? (
              <select
                value={currentSuggestedBlockIdDraft ?? ""}
                onChange={(event) => setCurrentSuggestedBlockIdDraft(event.target.value || null)}
                className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Automatico</option>
                {workoutDraft.map((block) => (
                  <option key={block.id} value={block.id}>{block.name}</option>
                ))}
              </select>
            ) : (
              <p className="mt-3 text-sm font-medium">{primaryWorkout?.block?.name ?? "Automatico"}</p>
            )}
          </div>
        </div>

        {workout.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/60 py-14 text-center text-muted-foreground">
            <Dumbbell className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>Nenhum treino cadastrado para este aluno.</p>
            {editingWorkout && <Button variant="outline" className="mt-4" onClick={addBlock}><Plus className="mr-2 h-4 w-4" />Adicionar bloco</Button>}
          </div>
        ) : (
          <div className="space-y-4">
            {workout.map((block) => (
              <article key={block.id} className="overflow-hidden rounded-[24px] border border-border/60 bg-background/60">
                <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  {editingWorkout ? <Input value={block.name} onChange={(event) => updateBlock(block.id, event.target.value)} className="h-10 w-full bg-card sm:max-w-xs" /> : <h3 className="font-semibold">{block.name}</h3>}
                  {editingWorkout && <Button variant="ghost" className="w-full text-destructive hover:text-destructive sm:w-auto" onClick={() => removeBlock(block.id)}><Trash2 className="mr-2 h-4 w-4" />Remover bloco</Button>}
                </div>

                <div className="divide-y divide-border/60">
                  {block.exercises.map((exercise, index) => (
                    <div key={exercise.id} className="px-4 py-4">
                      {editingWorkout ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="w-5 text-xs text-muted-foreground">{index + 1}.</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{exercise.name || "Exercicio sem nome"}</p>
                            </div>
                            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                              <Button variant="ghost" size="sm" className="flex-1 sm:flex-none" onClick={() => setEditorState({ blockId: block.id, exerciseId: exercise.id })}><Edit className="mr-1 h-4 w-4" />Editar</Button>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeExercise(block.id, exercise.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                          <div className="grid gap-3 pl-7 sm:grid-cols-2 lg:grid-cols-5">
                            <div><Label className="text-xs">Series</Label><Input type="number" value={exercise.sets} onChange={(event) => updateExercise(block.id, exercise.id, { sets: Number(event.target.value) || 0 })} className="mt-1 h-10 bg-card" /></div>
                            <div><Label className="text-xs">Repeticoes</Label><Input value={exercise.reps} onChange={(event) => updateExercise(block.id, exercise.id, { reps: event.target.value })} className="mt-1 h-10 bg-card" /></div>
                            <div><Label className="text-xs">Carga</Label><Input value={exercise.load} onChange={(event) => updateExercise(block.id, exercise.id, { load: event.target.value })} className="mt-1 h-10 bg-card" /></div>
                            <div><Label className="text-xs">Descanso</Label><Input value={exercise.rest} onChange={(event) => updateExercise(block.id, exercise.id, { rest: event.target.value })} className="mt-1 h-10 bg-card" /></div>
                            <div><Label className="text-xs">Observacoes</Label><Input value={exercise.notes} onChange={(event) => updateExercise(block.id, exercise.id, { notes: event.target.value })} className="mt-1 h-10 bg-card" /></div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 w-5 text-xs text-muted-foreground">{index + 1}.</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{exercise.name}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{exercise.sets}x{exercise.reps}</span>
                                {exercise.load && exercise.load !== "-" && <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{exercise.load}</span>}
                                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Descanso: {exercise.rest}</span>
                              </div>
                              {exercise.description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{exercise.description}</p>}
                              {exercise.notes && <p className="mt-3 text-xs italic text-muted-foreground">Observacoes do professor: {exercise.notes}</p>}
                            </div>
                          </div>
                          <ExerciseMediaPreview exercise={exercise} />
                        </div>
                      )}
                    </div>
                  ))}

                  {editingWorkout && (
                    <div className="flex flex-wrap gap-2 px-4 py-3">
                      <Button variant="outline" onClick={() => setEditorState({ blockId: block.id })}><Plus className="mr-2 h-4 w-4" />Novo exercicio</Button>
                      <Button variant="ghost" onClick={() => setPickerBlockId(block.id)}><Plus className="mr-2 h-4 w-4" />Usar da biblioteca</Button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            {editingWorkout && <Button variant="outline" onClick={addBlock}><Plus className="mr-2 h-4 w-4" />Adicionar bloco</Button>}
          </div>
        )}
      </section>

      <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} student={student} />
      <ImportWorkoutDialog open={importOpen} onOpenChange={setImportOpen} studentId={student.id} />
      <StudentTemporaryPasswordDialog
        open={temporaryAccess !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTemporaryAccess(null);
          }
        }}
        studentId={temporaryAccess?.studentId || ""}
        studentName={temporaryAccess?.studentName || student.fullName}
        email={temporaryAccess?.email || student.email}
        phone={temporaryAccess?.phone || student.phone}
        temporaryPassword={temporaryAccess?.temporaryPassword || ""}
        generatedAt={temporaryAccess?.generatedAt || ""}
        accessLink={temporaryAccess?.accessLink || ""}
        emailDelivery={temporaryAccess?.emailDelivery}
      />

      <ExerciseEditorDialog
        open={editorState !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditorState(null);
        }}
        exercise={editingExercise}
        onSave={saveExercise}
      />

      <ExerciseLibraryPickerDialog
        open={pickerBlockId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPickerBlockId(null);
        }}
        onSelectExercise={(exercise) => {
          if (!pickerBlockId) return;
          addExerciseToBlock(pickerBlockId, exercise);
          setPickerBlockId(null);
        }}
      />
    </div>
  );
}
