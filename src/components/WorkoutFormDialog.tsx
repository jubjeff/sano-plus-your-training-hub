import { useEffect, useMemo, useState } from "react";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { Exercise, Workout, WorkoutBlock } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ExerciseEditorDialog from "@/components/ExerciseEditorDialog";
import ExerciseLibraryPickerDialog from "@/components/ExerciseLibraryPickerDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout?: Workout;
}

export default function WorkoutFormDialog({ open, onOpenChange, workout }: Props) {
  const { addWorkout, updateWorkout } = useStore();
  const isEditing = !!workout;
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [pickerBlockId, setPickerBlockId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ blockId: string; exerciseId?: string } | null>(null);

  useEffect(() => {
    if (workout) {
      setName(workout.name);
      setObjective(workout.objective);
      setNotes(workout.notes);
      setBlocks(JSON.parse(JSON.stringify(workout.blocks)));
      return;
    }

    setName("");
    setObjective("");
    setNotes("");
    setBlocks([{ id: generateId(), name: "Treino A", exercises: [] }]);
  }, [open, workout]);

  const editingExercise = useMemo(() => {
    if (!editorState?.exerciseId) return undefined;
    return blocks
      .find((block) => block.id === editorState.blockId)
      ?.exercises.find((exercise) => exercise.id === editorState.exerciseId);
  }, [blocks, editorState]);

  const addBlock = () => {
    const letter = String.fromCharCode(65 + blocks.length);
    setBlocks((current) => [...current, { id: generateId(), name: `Treino ${letter}`, exercises: [] }]);
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => current.filter((block) => block.id !== id));
  };

  const removeExercise = (blockId: string, exerciseId: string) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, exercises: block.exercises.filter((exercise) => exercise.id !== exerciseId) } : block,
      ),
    );
  };

  const addExerciseToBlock = (blockId: string, exercise: Exercise) => {
    setBlocks((current) =>
      current.map((block) => (block.id === blockId ? { ...block, exercises: [...block.exercises, exercise] } : block)),
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (isEditing && workout) {
      updateWorkout(workout.id, { name, objective, notes, blocks });
    } else {
      addWorkout({ name, objective, notes, blocks });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-display">{isEditing ? "Editar treino" : "Novo treino"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <DialogBody className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do treino</Label>
              <Input required value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Input value={objective} onChange={(event) => setObjective(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label className="text-base">Blocos de treino</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBlock}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Bloco
              </Button>
            </div>

            {blocks.map((block) => (
              <section key={block.id} className="overflow-hidden rounded-[24px] border border-border/60 bg-background/70">
                <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    value={block.name}
                    onChange={(event) => setBlocks((current) => current.map((item) => (item.id === block.id ? { ...item, name: event.target.value } : item)))}
                    className="h-10 w-full bg-card sm:max-w-[280px]"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(block.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remover bloco
                  </Button>
                </div>

                <div className="space-y-3 p-4">
                  {block.exercises.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhum exercício neste bloco ainda.
                    </div>
                  )}

                  {block.exercises.map((exercise, index) => (
                    <article key={exercise.id} className="rounded-[20px] border border-border/60 bg-card/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">{index + 1}.</span>
                            <h3 className="truncate text-sm font-semibold">{exercise.name || "Exercício sem nome"}</h3>
                          </div>
                          {exercise.description && <p className="mt-2 text-sm text-muted-foreground">{exercise.description}</p>}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {exercise.muscleCategory && <Badge variant="outline">{exercise.muscleCategory}</Badge>}
                            {exercise.muscleGroupPrimary && <Badge variant="secondary" className="bg-primary/10 text-primary">{exercise.muscleGroupPrimary}</Badge>}
                            {(exercise.muscleGroupsSecondary ?? []).slice(0, 2).map((item) => (
                              <Badge key={`${exercise.id}-${item}`} variant="outline">{item}</Badge>
                            ))}
                            {exercise.equipment && <Badge variant="outline">{exercise.equipment}</Badge>}
                            {(exercise.videoFileUrl || exercise.videoStorageKey) && <Badge variant="outline">MP4</Badge>}
                            {exercise.youtubeEmbedUrl && <Badge variant="outline">YouTube</Badge>}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditorState({ blockId: block.id, exerciseId: exercise.id })}>
                            <Edit className="mr-1 h-4 w-4" />
                            Editar
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeExercise(block.id, exercise.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remover
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Séries</Label>
                          <Input type="number" value={exercise.sets} onChange={(event) => updateExercise(block.id, exercise.id, { sets: Number(event.target.value) || 0 })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Repetições</Label>
                          <Input value={exercise.reps} onChange={(event) => updateExercise(block.id, exercise.id, { reps: event.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Carga</Label>
                          <Input value={exercise.load} onChange={(event) => updateExercise(block.id, exercise.id, { load: event.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Descanso</Label>
                          <Input value={exercise.rest} onChange={(event) => updateExercise(block.id, exercise.id, { rest: event.target.value })} />
                        </div>
                      </div>
                    </article>
                  ))}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditorState({ blockId: block.id })}>
                      <Plus className="mr-1 h-4 w-4" />
                      Novo exercício
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPickerBlockId(block.id)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Usar da biblioteca
                    </Button>
                  </div>
                </div>
              </section>
            ))}
          </div>

          </DialogBody>

          <DialogFooter className="border-t border-border/60 bg-background/95">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{isEditing ? "Salvar" : "Criar treino"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>

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
    </Dialog>
  );
}
