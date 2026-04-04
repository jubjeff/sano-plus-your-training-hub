import { useEffect, useState } from "react";
import { useStore } from "@/hooks/use-store";
import { Exercise, Workout, WorkoutBlock } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ExerciseSearchDialog from "@/components/ExerciseSearchDialog";
import { Plus, Search, Trash2 } from "lucide-react";

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
  const [exercisePickerBlockId, setExercisePickerBlockId] = useState<string | null>(null);

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
  }, [workout, open]);

  const addBlock = () => {
    const letter = String.fromCharCode(65 + blocks.length);
    setBlocks((current) => [...current, { id: generateId(), name: `Treino ${letter}`, exercises: [] }]);
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => current.filter((block) => block.id !== id));
  };

  const addExercise = (blockId: string) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              exercises: [...block.exercises, { id: generateId(), name: "", sets: 3, reps: "12", load: "", rest: "60s", notes: "" }],
            }
          : block,
      ),
    );
  };

  const addImportedExercise = (blockId: string, exercise: Exercise) => {
    setBlocks((current) =>
      current.map((block) => (block.id === blockId ? { ...block, exercises: [...block.exercises, exercise] } : block)),
    );
  };

  const removeExercise = (blockId: string, exId: string) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, exercises: block.exercises.filter((exercise) => exercise.id !== exId) } : block,
      ),
    );
  };

  const updateExercise = (blockId: string, exId: string, data: Partial<Exercise>) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, exercises: block.exercises.map((exercise) => (exercise.id === exId ? { ...exercise, ...data } : exercise)) }
          : block,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && workout) {
      updateWorkout(workout.id, { name, objective, notes, blocks });
    } else {
      addWorkout({ name, objective, notes, blocks });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{isEditing ? "Editar treino" : "Novo treino"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do treino</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Input value={objective} onChange={(e) => setObjective(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Blocos de treino</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBlock}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Bloco
              </Button>
            </div>

            {blocks.map((block) => (
              <div key={block.id} className="overflow-hidden rounded-lg border">
                <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
                  <Input
                    value={block.name}
                    onChange={(e) => setBlocks((current) => current.map((item) => (item.id === block.id ? { ...item, name: e.target.value } : item)))}
                    className="h-8 max-w-[220px] bg-card text-sm"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(block.id)} className="h-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-3 p-3">
                  {block.exercises.map((exercise, index) => (
                    <div key={exercise.id} className="flex items-start gap-2">
                      <span className="mt-2 w-4 text-xs text-muted-foreground">{index + 1}.</span>
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
                          <Input placeholder="Exercício" value={exercise.name} onChange={(e) => updateExercise(block.id, exercise.id, { name: e.target.value })} className="col-span-2 h-8 text-xs" />
                          <Input placeholder="Séries" type="number" value={exercise.sets} onChange={(e) => updateExercise(block.id, exercise.id, { sets: Number(e.target.value) })} className="h-8 text-xs" />
                          <Input placeholder="Reps" value={exercise.reps} onChange={(e) => updateExercise(block.id, exercise.id, { reps: e.target.value })} className="h-8 text-xs" />
                          <Input placeholder="Carga" value={exercise.load} onChange={(e) => updateExercise(block.id, exercise.id, { load: e.target.value })} className="h-8 text-xs" />
                          <Input placeholder="Descanso" value={exercise.rest} onChange={(e) => updateExercise(block.id, exercise.id, { rest: e.target.value })} className="h-8 text-xs" />
                        </div>

                        {(exercise.summary || exercise.imageUrl || (exercise.muscles?.length ?? 0) > 0 || (exercise.equipment?.length ?? 0) > 0) && (
                          <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
                            <div className="flex gap-3">
                              {exercise.imageUrl && <img src={exercise.imageUrl} alt={exercise.name} className="h-16 w-16 rounded-xl object-cover" />}
                              <div className="min-w-0 flex-1">
                                {exercise.summary && <p className="text-xs leading-5 text-muted-foreground">{exercise.summary}</p>}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {(exercise.muscles ?? []).slice(0, 3).map((item) => (
                                    <Badge key={`${exercise.id}-${item}`} variant="secondary" className="bg-primary/10 text-primary">
                                      {item}
                                    </Badge>
                                  ))}
                                  {(exercise.equipment ?? []).slice(0, 2).map((item) => (
                                    <Badge key={`${exercise.id}-eq-${item}`} variant="outline">
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeExercise(block.id, exercise.id)} className="h-8 w-8 shrink-0 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => addExercise(block.id)} className="text-primary">
                      <Plus className="mr-1 h-3 w-3" />
                      Exercício manual
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setExercisePickerBlockId(block.id)}>
                      <Search className="mr-1 h-3.5 w-3.5" />
                      Buscar na ExerciseDB
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{isEditing ? "Salvar" : "Criar treino"}</Button>
          </div>
        </form>
      </DialogContent>
      <ExerciseSearchDialog
        open={exercisePickerBlockId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setExercisePickerBlockId(null);
        }}
        onSelectExercise={(exercise) => {
          if (!exercisePickerBlockId) return;
          addImportedExercise(exercisePickerBlockId, exercise);
          setExercisePickerBlockId(null);
        }}
      />
    </Dialog>
  );
}
