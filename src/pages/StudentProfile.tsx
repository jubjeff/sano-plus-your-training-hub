import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/hooks/use-store";
import { ArrowLeft, Edit, UserCheck, UserX, Dumbbell, Download, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import StudentFormDialog from "@/components/StudentFormDialog";
import ImportWorkoutDialog from "@/components/ImportWorkoutDialog";
import { WorkoutBlock, Exercise } from "@/types";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { students, updateStudent } = useStore();
  const student = students.find((s) => s.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutBlock[]>([]);

  if (!student) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Aluno não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/alunos")}>
          Voltar
        </Button>
      </div>
    );
  }

  const startEditWorkout = () => {
    setWorkoutDraft(JSON.parse(JSON.stringify(student.workout)));
    setEditingWorkout(true);
  };

  const saveWorkout = () => {
    updateStudent(student.id, {
      workout: workoutDraft,
      workoutUpdatedAt: new Date().toISOString().split("T")[0],
    });
    setEditingWorkout(false);
  };

  const addBlock = () => {
    const letter = String.fromCharCode(65 + workoutDraft.length);
    setWorkoutDraft([
      ...workoutDraft,
      { id: generateId(), name: `Treino ${letter}`, exercises: [] },
    ]);
  };

  const removeBlock = (blockId: string) => {
    setWorkoutDraft(workoutDraft.filter((b) => b.id !== blockId));
  };

  const updateBlock = (blockId: string, name: string) => {
    setWorkoutDraft(workoutDraft.map((b) => (b.id === blockId ? { ...b, name } : b)));
  };

  const addExercise = (blockId: string) => {
    setWorkoutDraft(
      workoutDraft.map((b) =>
        b.id === blockId
          ? { ...b, exercises: [...b.exercises, { id: generateId(), name: "", sets: 3, reps: "12", load: "", rest: "60s", notes: "" }] }
          : b
      )
    );
  };

  const removeExercise = (blockId: string, exerciseId: string) => {
    setWorkoutDraft(
      workoutDraft.map((b) =>
        b.id === blockId ? { ...b, exercises: b.exercises.filter((e) => e.id !== exerciseId) } : b
      )
    );
  };

  const updateExercise = (blockId: string, exerciseId: string, data: Partial<Exercise>) => {
    setWorkoutDraft(
      workoutDraft.map((b) =>
        b.id === blockId
          ? { ...b, exercises: b.exercises.map((e) => (e.id === exerciseId ? { ...e, ...data } : e)) }
          : b
      )
    );
  };

  const workout = editingWorkout ? workoutDraft : student.workout;

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate("/alunos")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Voltar para alunos
      </button>

      {/* Student header */}
      <div className="rounded-xl bg-card border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
            {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-xl font-bold">{student.name}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                student.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              }`}>
                {student.active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{student.objective}</p>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
              <span>📧 {student.email}</span>
              <span>📱 {student.phone}</span>
              <span>📅 Início: {new Date(student.startDate).toLocaleDateString("pt-BR")}</span>
            </div>
            {student.notes && <p className="text-sm text-muted-foreground mt-2 italic">"{student.notes}"</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateStudent(student.id, { active: !student.active })}
            >
              {student.active ? <UserX className="h-4 w-4 mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
              {student.active ? "Inativar" : "Ativar"}
            </Button>
          </div>
        </div>
      </div>

      {/* Workout section */}
      <div className="rounded-xl bg-card border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Treino Atual</h2>
            {student.workoutUpdatedAt && (
              <span className="text-xs text-muted-foreground">
                (atualizado em {new Date(student.workoutUpdatedAt).toLocaleDateString("pt-BR")})
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Download className="h-4 w-4 mr-1" />
              Importar
            </Button>
            {editingWorkout ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditingWorkout(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={saveWorkout}>
                  Salvar
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={startEditWorkout}>
                <Edit className="h-4 w-4 mr-1" />
                Editar Treino
              </Button>
            )}
          </div>
        </div>

        {workout.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Dumbbell className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum treino cadastrado</p>
            {editingWorkout && (
              <Button variant="outline" size="sm" className="mt-3" onClick={addBlock}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar bloco
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {workout.map((block) => (
              <div key={block.id} className="rounded-lg border bg-muted/30 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
                  {editingWorkout ? (
                    <Input
                      value={block.name}
                      onChange={(e) => updateBlock(block.id, e.target.value)}
                      className="h-8 max-w-xs bg-card"
                    />
                  ) : (
                    <h3 className="font-semibold text-sm">{block.name}</h3>
                  )}
                  {editingWorkout && (
                    <Button variant="ghost" size="sm" onClick={() => removeBlock(block.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="divide-y">
                  {block.exercises.map((ex, idx) => (
                    <div key={ex.id} className="px-4 py-3">
                      {editingWorkout ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                            <Input
                              placeholder="Nome do exercício"
                              value={ex.name}
                              onChange={(e) => updateExercise(block.id, ex.id, { name: e.target.value })}
                              className="h-8 flex-1 bg-card"
                            />
                            <Button variant="ghost" size="sm" onClick={() => removeExercise(block.id, ex.id)} className="text-destructive hover:text-destructive shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pl-7">
                            <div>
                              <Label className="text-xs">Séries</Label>
                              <Input type="number" value={ex.sets} onChange={(e) => updateExercise(block.id, ex.id, { sets: Number(e.target.value) })} className="h-8 bg-card" />
                            </div>
                            <div>
                              <Label className="text-xs">Reps</Label>
                              <Input value={ex.reps} onChange={(e) => updateExercise(block.id, ex.id, { reps: e.target.value })} className="h-8 bg-card" />
                            </div>
                            <div>
                              <Label className="text-xs">Carga</Label>
                              <Input value={ex.load} onChange={(e) => updateExercise(block.id, ex.id, { load: e.target.value })} className="h-8 bg-card" />
                            </div>
                            <div>
                              <Label className="text-xs">Descanso</Label>
                              <Input value={ex.rest} onChange={(e) => updateExercise(block.id, ex.id, { rest: e.target.value })} className="h-8 bg-card" />
                            </div>
                            <div>
                              <Label className="text-xs">Obs</Label>
                              <Input value={ex.notes} onChange={(e) => updateExercise(block.id, ex.id, { notes: e.target.value })} className="h-8 bg-card" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-muted-foreground mt-0.5 w-5">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{ex.name}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{ex.sets}x{ex.reps}</span>
                              {ex.load && ex.load !== "-" && <span className="text-xs bg-muted px-2 py-0.5 rounded">{ex.load}</span>}
                              <span className="text-xs bg-muted px-2 py-0.5 rounded">⏱ {ex.rest}</span>
                              {ex.notes && <span className="text-xs text-muted-foreground italic">{ex.notes}</span>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {editingWorkout && (
                    <div className="px-4 py-2">
                      <Button variant="ghost" size="sm" onClick={() => addExercise(block.id)} className="text-primary">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Adicionar exercício
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {editingWorkout && (
              <Button variant="outline" size="sm" onClick={addBlock}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar bloco
              </Button>
            )}
          </div>
        )}
      </div>

      <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} student={student} />
      <ImportWorkoutDialog open={importOpen} onOpenChange={setImportOpen} studentId={student.id} />
    </div>
  );
}
