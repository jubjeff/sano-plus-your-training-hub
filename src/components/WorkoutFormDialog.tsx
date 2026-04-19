import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/use-auth";
import { useStore } from "@/hooks/use-store";
import { ExerciseLibraryItem, Workout, WorkoutBlock } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ExerciseEditorDialog from "@/components/ExerciseEditorDialog";
import ExerciseLibraryPickerDialog from "@/components/ExerciseLibraryPickerDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createExerciseAssignmentFromLibrary, resolveExerciseFromLibrary } from "@/lib/exercise-utils";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout?: Workout;
}

export default function WorkoutFormDialog({ open, onOpenChange, workout }: Props) {
  const { user } = useAuth();
  const { addWorkout, updateWorkout, addExerciseLibraryItem, exerciseLibrary } = useStore();
  const isEditing = !!workout;
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [pickerBlockId, setPickerBlockId] = useState<string | null>(null);
  const [createLibraryBlockId, setCreateLibraryBlockId] = useState<string | null>(null);
  const canManageExerciseLibrary = user?.role === "coach" && user.platformRole === "dev_admin";

  const exerciseLibraryMap = useMemo(
    () => new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise])),
    [exerciseLibrary],
  );

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

  const updateExercise = (blockId: string, exerciseId: string, data: Partial<WorkoutBlock["exercises"][number]>) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, exercises: block.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...data } : exercise)) }
          : block,
      ),
    );
  };

  const addExerciseToBlock = (blockId: string, libraryExercise: ExerciseLibraryItem) => {
    const assignment = createExerciseAssignmentFromLibrary(libraryExercise);
    setBlocks((current) =>
      current.map((block) => (block.id === blockId ? { ...block, exercises: [...block.exercises, assignment] } : block)),
    );
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
              <Label>Observacoes</Label>
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
                        Nenhum exercicio neste bloco ainda.
                      </div>
                    )}

                    {block.exercises.map((exercise, index) => {
                      const resolvedExercise = resolveExerciseFromLibrary(exercise, exerciseLibraryMap);
                      return (
                        <article key={exercise.id} className="rounded-[20px] border border-border/60 bg-card/60 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">{index + 1}.</span>
                                <h3 className="truncate text-sm font-semibold">{resolvedExercise.name || "Exercicio sem nome"}</h3>
                              </div>
                              {resolvedExercise.description && <p className="mt-2 text-sm text-muted-foreground">{resolvedExercise.description}</p>}

                              <div className="mt-3 flex flex-wrap gap-2">
                                {resolvedExercise.category && <Badge variant="outline">{resolvedExercise.category}</Badge>}
                                {resolvedExercise.muscleGroupPrimary && <Badge variant="secondary" className="bg-primary/10 text-primary">{resolvedExercise.muscleGroupPrimary}</Badge>}
                                {(resolvedExercise.muscleGroupsSecondary ?? []).slice(0, 2).map((item) => (
                                  <Badge key={`${exercise.id}-${item}`} variant="outline">{item}</Badge>
                                ))}
                                {resolvedExercise.equipment && <Badge variant="outline">{resolvedExercise.equipment}</Badge>}
                                {resolvedExercise.difficultyLevel && <Badge variant="outline">{resolvedExercise.difficultyLevel}</Badge>}
                                {resolvedExercise.videoUrl && <Badge variant="outline">MP4</Badge>}
                              </div>
                            </div>

                            <Button type="button" variant="ghost" size="sm" onClick={() => removeExercise(block.id, exercise.id)} className="text-destructive hover:text-destructive">
                              <Trash2 className="mr-1 h-4 w-4" />
                              Remover
                            </Button>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-5">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Series</Label>
                              <Input type="number" value={exercise.sets} onChange={(event) => updateExercise(block.id, exercise.id, { sets: Number(event.target.value) || 0 })} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Repeticoes</Label>
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
                            <div className="space-y-1.5">
                              <Label className="text-xs">Observacoes</Label>
                              <Input value={exercise.notes} onChange={(event) => updateExercise(block.id, exercise.id, { notes: event.target.value })} />
                            </div>
                          </div>
                        </article>
                      );
                    })}

                    <div className="flex flex-wrap gap-2">
                      {canManageExerciseLibrary ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => setCreateLibraryBlockId(block.id)}>
                          <Plus className="mr-1 h-4 w-4" />
                          Criar exercicio
                        </Button>
                      ) : null}
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

      {canManageExerciseLibrary ? (
        <ExerciseEditorDialog
          open={createLibraryBlockId !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setCreateLibraryBlockId(null);
          }}
          onSave={async ({ exercise, videoFile, removeVideo }) => {
            if (!createLibraryBlockId) return;
            const createdExercise = await addExerciseLibraryItem({
              ...exercise,
              videoFile,
              removeVideo,
            });
            addExerciseToBlock(createLibraryBlockId, createdExercise);
            setCreateLibraryBlockId(null);
          }}
        />
      ) : null}

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
