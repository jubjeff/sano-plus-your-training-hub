import { useState, useEffect } from "react";
import { useStore } from "@/hooks/use-store";
import { Workout, WorkoutBlock, Exercise } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

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

  useEffect(() => {
    if (workout) {
      setName(workout.name);
      setObjective(workout.objective);
      setNotes(workout.notes);
      setBlocks(JSON.parse(JSON.stringify(workout.blocks)));
    } else {
      setName("");
      setObjective("");
      setNotes("");
      setBlocks([{ id: generateId(), name: "Treino A", exercises: [] }]);
    }
  }, [workout, open]);

  const addBlock = () => {
    const letter = String.fromCharCode(65 + blocks.length);
    setBlocks([...blocks, { id: generateId(), name: `Treino ${letter}`, exercises: [] }]);
  };

  const removeBlock = (id: string) => setBlocks(blocks.filter((b) => b.id !== id));

  const addExercise = (blockId: string) => {
    setBlocks(blocks.map((b) =>
      b.id === blockId
        ? { ...b, exercises: [...b.exercises, { id: generateId(), name: "", sets: 3, reps: "12", load: "", rest: "60s", notes: "" }] }
        : b
    ));
  };

  const removeExercise = (blockId: string, exId: string) => {
    setBlocks(blocks.map((b) =>
      b.id === blockId ? { ...b, exercises: b.exercises.filter((e) => e.id !== exId) } : b
    ));
  };

  const updateExercise = (blockId: string, exId: string, data: Partial<Exercise>) => {
    setBlocks(blocks.map((b) =>
      b.id === blockId
        ? { ...b, exercises: b.exercises.map((e) => (e.id === exId ? { ...e, ...data } : e)) }
        : b
    ));
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{isEditing ? "Editar Treino" : "Novo Treino"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
                <Plus className="h-3.5 w-3.5 mr-1" />
                Bloco
              </Button>
            </div>

            {blocks.map((block) => (
              <div key={block.id} className="rounded-lg border overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                  <Input
                    value={block.name}
                    onChange={(e) => setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, name: e.target.value } : b)))}
                    className="h-7 max-w-[200px] bg-card text-sm"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(block.id)} className="text-destructive hover:text-destructive h-7">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="p-3 space-y-2">
                  {block.exercises.map((ex, idx) => (
                    <div key={ex.id} className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground mt-2 w-4">{idx + 1}.</span>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                        <Input placeholder="Exercício" value={ex.name} onChange={(e) => updateExercise(block.id, ex.id, { name: e.target.value })} className="h-8 text-xs col-span-2" />
                        <Input placeholder="Séries" type="number" value={ex.sets} onChange={(e) => updateExercise(block.id, ex.id, { sets: Number(e.target.value) })} className="h-8 text-xs" />
                        <Input placeholder="Reps" value={ex.reps} onChange={(e) => updateExercise(block.id, ex.id, { reps: e.target.value })} className="h-8 text-xs" />
                        <Input placeholder="Carga" value={ex.load} onChange={(e) => updateExercise(block.id, ex.id, { load: e.target.value })} className="h-8 text-xs" />
                        <Input placeholder="Descanso" value={ex.rest} onChange={(e) => updateExercise(block.id, ex.id, { rest: e.target.value })} className="h-8 text-xs" />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeExercise(block.id, ex.id)} className="text-destructive hover:text-destructive h-8 w-8 p-0 shrink-0">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => addExercise(block.id)} className="text-primary text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Exercício
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{isEditing ? "Salvar" : "Criar Treino"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
