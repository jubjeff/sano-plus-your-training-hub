import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Download, Dumbbell, Edit, Mail, Phone, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImportWorkoutDialog from "@/components/ImportWorkoutDialog";
import StudentFormDialog from "@/components/StudentFormDialog";
import { Exercise, WorkoutBlock } from "@/types";
import { formatDate, getInitials, getRelativeWorkoutLabel } from "@/lib/format";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { students, updateStudent } = useStore();
  const student = students.find((item) => item.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutBlock[]>([]);

  if (!student) {
    return (
      <div className="section-shell py-16 text-center">
        <p className="text-muted-foreground">Aluno não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/alunos")}>Voltar</Button>
      </div>
    );
  }

  const startEditWorkout = () => {
    setWorkoutDraft(JSON.parse(JSON.stringify(student.workout)));
    setEditingWorkout(true);
  };

  const saveWorkout = () => {
    updateStudent(student.id, { workout: workoutDraft, workoutUpdatedAt: new Date().toISOString().split("T")[0] });
    setEditingWorkout(false);
  };

  const addBlock = () => {
    const letter = String.fromCharCode(65 + workoutDraft.length);
    setWorkoutDraft((current) => [...current, { id: generateId(), name: `Treino ${letter}`, exercises: [] }]);
  };

  const removeBlock = (blockId: string) => {
    setWorkoutDraft((current) => current.filter((block) => block.id !== blockId));
  };

  const updateBlock = (blockId: string, name: string) => {
    setWorkoutDraft((current) => current.map((block) => (block.id === blockId ? { ...block, name } : block)));
  };

  const addExercise = (blockId: string) => {
    setWorkoutDraft((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, exercises: [...block.exercises, { id: generateId(), name: "", sets: 3, reps: "12", load: "", rest: "60s", notes: "" }] } : block,
      ),
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
        block.id === blockId ? { ...block, exercises: block.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...data } : exercise)) } : block,
      ),
    );
  };

  const workout = editingWorkout ? workoutDraft : student.workout;

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={() => navigate("/alunos")} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar para alunos
      </button>

      <section className="section-shell overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-primary/12 text-2xl font-bold text-primary">{getInitials(student.name)}</div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold tracking-tight">{student.name}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{student.active ? "Ativo" : "Inativo"}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{student.objective}</p>
              <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />{student.email || "Sem e-mail"}</span>
                <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{student.phone || "Sem telefone"}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />Início em {formatDate(student.startDate)}</span>
              </div>
              {student.notes && <p className="mt-4 max-w-2xl rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">{student.notes}</p>}
            </div>
          </div>

          <div className="rounded-[24px] border border-border/60 bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Próxima troca</p>
            <p className="mt-3 text-2xl font-semibold">{getRelativeWorkoutLabel(student.nextWorkoutChange)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{student.workoutUpdatedAt ? `Última atualização em ${formatDate(student.workoutUpdatedAt)}` : "Sem atualização registrada"}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}><Edit className="mr-2 h-4 w-4" />Editar cadastro</Button>
              <Button variant="outline" onClick={() => updateStudent(student.id, { active: !student.active })}>{student.active ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}{student.active ? "Inativar aluno" : "Ativar aluno"}</Button>
            </div>
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
          <div className="flex flex-wrap gap-2">
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
                  {editingWorkout ? <Input value={block.name} onChange={(event) => updateBlock(block.id, event.target.value)} className="h-10 max-w-xs bg-card" /> : <h3 className="font-semibold">{block.name}</h3>}
                  {editingWorkout && <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeBlock(block.id)}><Trash2 className="mr-2 h-4 w-4" />Remover bloco</Button>}
                </div>

                <div className="divide-y divide-border/60">
                  {block.exercises.map((exercise, index) => (
                    <div key={exercise.id} className="px-4 py-4">
                      {editingWorkout ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 text-xs text-muted-foreground">{index + 1}.</span>
                            <Input placeholder="Nome do exercício" value={exercise.name} onChange={(event) => updateExercise(block.id, exercise.id, { name: event.target.value })} className="h-10 flex-1 bg-card" />
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeExercise(block.id, exercise.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                          <div className="grid gap-3 pl-7 sm:grid-cols-2 lg:grid-cols-5">
                            <div><Label className="text-xs">Séries</Label><Input type="number" value={exercise.sets} onChange={(event) => updateExercise(block.id, exercise.id, { sets: Number(event.target.value) })} className="mt-1 h-10 bg-card" /></div>
                            <div><Label className="text-xs">Repetições</Label><Input value={exercise.reps} onChange={(event) => updateExercise(block.id, exercise.id, { reps: event.target.value })} className="mt-1 h-10 bg-card" /></div>
                            <div><Label className="text-xs">Carga</Label><Input value={exercise.load} onChange={(event) => updateExercise(block.id, exercise.id, { load: event.target.value })} className="mt-1 h-10 bg-card" /></div>
                            <div><Label className="text-xs">Descanso</Label><Input value={exercise.rest} onChange={(event) => updateExercise(block.id, exercise.id, { rest: event.target.value })} className="mt-1 h-10 bg-card" /></div>
                            <div><Label className="text-xs">Observações</Label><Input value={exercise.notes} onChange={(event) => updateExercise(block.id, exercise.id, { notes: event.target.value })} className="mt-1 h-10 bg-card" /></div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 w-5 text-xs text-muted-foreground">{index + 1}.</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                              {exercise.imageUrl && <img src={exercise.imageUrl} alt={exercise.name} className="h-24 w-24 rounded-[20px] object-cover" />}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{exercise.name}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{exercise.sets}x{exercise.reps}</span>
                                  {exercise.load && exercise.load !== "-" && <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{exercise.load}</span>}
                                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Descanso: {exercise.rest}</span>
                                </div>
                                {(exercise.muscles?.length ?? 0) > 0 || (exercise.equipment?.length ?? 0) > 0 || exercise.bodyPart ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {exercise.bodyPart && <Badge variant="outline">{exercise.bodyPart}</Badge>}
                                    {(exercise.muscles ?? []).map((item) => <Badge key={`${exercise.id}-${item}`} variant="secondary" className="bg-primary/10 text-primary">{item}</Badge>)}
                                    {(exercise.equipment ?? []).map((item) => <Badge key={`${exercise.id}-eq-${item}`} variant="outline">{item}</Badge>)}
                                  </div>
                                ) : null}
                                {exercise.summary && <p className="mt-3 text-sm leading-6 text-muted-foreground">{exercise.summary}</p>}
                                {!exercise.summary && exercise.instructions && <p className="mt-3 text-sm leading-6 text-muted-foreground">{exercise.instructions}</p>}
                                {exercise.notes && <p className="mt-3 text-xs italic text-muted-foreground">Observações do professor: {exercise.notes}</p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {editingWorkout && <div className="px-4 py-3"><Button variant="ghost" onClick={() => addExercise(block.id)} className="text-primary"><Plus className="mr-2 h-4 w-4" />Adicionar exercício</Button></div>}
                </div>
              </article>
            ))}
            {editingWorkout && <Button variant="outline" onClick={addBlock}><Plus className="mr-2 h-4 w-4" />Adicionar bloco</Button>}
          </div>
        )}
      </section>

      <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} student={student} />
      <ImportWorkoutDialog open={importOpen} onOpenChange={setImportOpen} studentId={student.id} />
    </div>
  );
}
