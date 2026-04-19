import { Download } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
}

export default function ImportWorkoutDialog({ open, onOpenChange, studentId }: Props) {
  const { workouts, importWorkoutToStudent } = useStore();

  const handleImport = (workoutId: string) => {
    importWorkoutToStudent(studentId, workoutId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Importar treino da biblioteca</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {workouts.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhum treino disponível na biblioteca.</p>
          ) : (
            <div className="space-y-3">
              {workouts.map((workout) => (
                <div
                  key={workout.id}
                  className="flex flex-col gap-3 rounded-[20px] border border-border/60 bg-background/70 p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{workout.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {workout.objective} • {workout.blocks.length} bloco(s)
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleImport(workout.id)} className="w-full sm:w-auto">
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Importar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
