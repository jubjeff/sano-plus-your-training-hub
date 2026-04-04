import { useStore } from "@/hooks/use-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Importar treino da biblioteca</DialogTitle>
        </DialogHeader>
        {workouts.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nenhum treino disponível na biblioteca.</p>
        ) : (
          <div className="max-h-96 space-y-3 overflow-auto">
            {workouts.map((workout) => (
              <div key={workout.id} className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold">{workout.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {workout.objective} · {workout.blocks.length} bloco(s)
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleImport(workout.id)}>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Importar
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
