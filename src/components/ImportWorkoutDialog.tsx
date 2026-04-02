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
          <DialogTitle className="font-display">Importar Treino da Biblioteca</DialogTitle>
        </DialogHeader>
        {workouts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum treino na biblioteca.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-auto">
            {workouts.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold">{w.name}</h4>
                  <p className="text-xs text-muted-foreground">{w.objective} · {w.blocks.length} bloco(s)</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleImport(w.id)}>
                  <Download className="h-3.5 w-3.5 mr-1" />
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
