import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Plus, Save, Trash2 } from "lucide-react";
import { Exercise, WorkoutBlock } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ExerciseEditorDialog from "@/components/ExerciseEditorDialog";
import ExerciseLibraryPickerDialog from "@/components/ExerciseLibraryPickerDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/hooks/use-store";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function WorkoutEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workouts, updateWorkout } = useStore();
  const workout = useMemo(() => workouts.find((item) => item.id === id), [id, workouts]);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [pickerBlockId, setPickerBlockId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ blockId: string; exerciseId?: string } | null>(null);

  useEffect(() => {
    if (!workout) return;
    setName(workout.name);
    setObjective(workout.objective);
    setNotes(workout.notes);
    setBlocks(JSON.parse(JSON.stringify(workout.blocks)));
  }, [workout]);

  const editingExercise = useMemo(() => {
    if (!editorState?.exerciseId) return undefined;
    return blocks
      .find((block) => block.id === editorState.blockId)
      ?.exercises.find((exercise) => exercise.id === editorState.exerciseId);
  }, [blocks, editorState]);

  if (!workout) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-[28px] border border-border/60 bg-card/60 p-10 text-center">
        <h1 className="font-display text-2xl font-semibold">Treino não encontrado</h1>
        <p className="max-w-md text-sm text-muted-foreground">O plano selecionado não existe mais ou ainda não foi carregado nesta sessão.</p>
        <Button variant="outline" onClick={() => navigate("/biblioteca")}>Voltar para a biblioteca</Button>
      </div>
    );
  }

  const updateBlockName = (blockId: string, value: string) => {
    setBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, name: value } : block)));
  };

  const addBlock = () => {
    const letter = String.fromCharCode(65 + blocks.length);
    setBlocks((current) => [...current, { id: generateId(), name: `Treino ${letter}`, exercises: [] }]);
  };

  const removeBlock = (blockId: string) => {
    setBlocks((current) => current.filter((block) => block.id !== blockId));
  };

  const addExerciseToBlock = (blockId: string, exercise: Exercise) => {
    setBlocks((current) =>
      current.map((block) => (block.id === blockId ? { ...block, exercises: [...block.exercises, exercise] } : block)),
    );
  };

  const removeExercise = (blockId: string, exerciseId: string) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, exercises: block.exercises.filter((exercise) => exercise.id !== exerciseId) } : block,
      ),
    );
  };

  const updateExercise = (blockId: string, exerciseId: string, data: Partial<Exercise>) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, exercises: block.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...data } : exercise)) }
          : block,
      ),
    );
  };

  const saveExercise = (exercise: Exercise) => {
    if (!editorState) return;

    setBlocks((current) =>
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

  const handleSave = () => {
    updateWorkout(workout.id, { name, objective, notes, blocks });
    navigate("/biblioteca");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={() => navigate("/biblioteca")} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a biblioteca
      </button>

      <section className="overflow-hidden rounded-[30px] border border-border/60 bg-card/75 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.85)] backdrop-blur">
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/14 via-primary/6 to-transparent p-6 lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Editor de treino</span>
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">Ajuste o treino com contexto real</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Monte exercícios manualmente, organize a musculatura e mantenha a biblioteca pronta para reutilização.</p>
              </div>
            </div>
            <Button className="min-w-40" onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Salvar treino
            </Button>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:p-8">
          <aside className="space-y-4 rounded-[24px] border border-border/60 bg-background/60 p-5">
            <div className="space-y-2">
              <Label htmlFor="workout-name">Nome do treino</Label>
              <Input id="workout-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workout-objective">Objetivo</Label>
              <Input id="workout-objective" value={objective} onChange={(event) => setObjective(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workout-notes">Notas estratégicas</Label>
              <Textarea id="workout-notes" rows={8} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexto, foco do treino, limitações e critérios de progressão." />
            </div>
          </aside>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">Blocos do treino</h2>
                <p className="text-sm text-muted-foreground">Estruture sessões reutilizáveis com leitura rápida e mídia didática.</p>
              </div>
              <Button variant="outline" onClick={addBlock}>
                <Plus className="mr-2 h-4 w-4" />
                Novo bloco
              </Button>
            </div>

            {blocks.map((block, blockIndex) => (
              <article key={block.id} className="rounded-[24px] border border-border/60 bg-background/70 p-5 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold text-primary">{blockIndex + 1}</div>
                    <Input value={block.name} onChange={(event) => updateBlockName(block.id, event.target.value)} className="h-10 min-w-0 sm:w-72" />
                  </div>
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeBlock(block.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover bloco
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {block.exercises.length === 0 && (
                    <div className="rounded-[20px] border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhum exercício neste bloco. Crie manualmente ou reutilize um da biblioteca.
                    </div>
                  )}

                  {block.exercises.map((exercise, exerciseIndex) => (
                    <div key={exercise.id} className="rounded-[20px] border border-border/60 bg-card/60 p-4">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-muted-foreground">{exerciseIndex + 1}.</span>
                            <h3 className="truncate text-base font-semibold">{exercise.name || "Exercício sem nome"}</h3>
                          </div>
                          {exercise.description && <p className="mt-2 text-sm text-muted-foreground">{exercise.description}</p>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {exercise.muscleCategory && <Badge variant="outline">{exercise.muscleCategory}</Badge>}
                            {exercise.muscleGroupPrimary && <Badge variant="secondary" className="bg-primary/10 text-primary">{exercise.muscleGroupPrimary}</Badge>}
                            {(exercise.muscleGroupsSecondary ?? []).slice(0, 3).map((item) => (
                              <Badge key={`${exercise.id}-${item}`} variant="outline">{item}</Badge>
                            ))}
                            {exercise.equipment && <Badge variant="outline">{exercise.equipment}</Badge>}
                            {(exercise.videoFileUrl || exercise.videoStorageKey) && <Badge variant="outline">MP4</Badge>}
                            {exercise.youtubeEmbedUrl && <Badge variant="outline">YouTube</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditorState({ blockId: block.id, exerciseId: exercise.id })}>
                            <Edit className="mr-1 h-4 w-4" />
                            Editar
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeExercise(block.id, exercise.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-5">
                        <div className="space-y-2"><Label>Séries</Label><Input type="number" value={exercise.sets} onChange={(event) => updateExercise(block.id, exercise.id, { sets: Number(event.target.value) || 0 })} /></div>
                        <div className="space-y-2"><Label>Repetições</Label><Input value={exercise.reps} onChange={(event) => updateExercise(block.id, exercise.id, { reps: event.target.value })} /></div>
                        <div className="space-y-2"><Label>Carga</Label><Input value={exercise.load} onChange={(event) => updateExercise(block.id, exercise.id, { load: event.target.value })} /></div>
                        <div className="space-y-2"><Label>Descanso</Label><Input value={exercise.rest} onChange={(event) => updateExercise(block.id, exercise.id, { rest: event.target.value })} /></div>
                        <div className="space-y-2"><Label>Observações</Label><Input value={exercise.notes} onChange={(event) => updateExercise(block.id, exercise.id, { notes: event.target.value })} /></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setEditorState({ blockId: block.id })}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo exercício
                  </Button>
                  <Button variant="ghost" onClick={() => setPickerBlockId(block.id)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Usar da biblioteca
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

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
