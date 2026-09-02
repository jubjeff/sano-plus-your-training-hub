import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
}

export default function ImportWorkoutDialog({ open, onOpenChange, studentId }: Props) {
  const { workouts, importWorkoutToStudent } = useStore();
  const [importingId, setImportingId] = useState<string | null>(null);

  /**
   * A importação é assíncrona e vai ao Supabase. Antes a chamada não era
   * aguardada nem tratada: o diálogo fechava na hora e, se a gravação
   * falhasse, a rejeição sumia sem nenhum aviso — parecia que tinha importado.
   */
  const handleImport = async (workoutId: string) => {
    setImportingId(workoutId);
    try {
      await importWorkoutToStudent(studentId, workoutId);
      toast.success("Treino importado para o aluno.");
      onOpenChange(false);
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : String(error);
      toast.error(detalhe || "Não foi possível importar o treino. Tente novamente.");
    } finally {
      setImportingId(null);
    }
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleImport(workout.id)}
                    disabled={importingId !== null}
                    className="w-full shrink-0 sm:w-auto"
                  >
                    {importingId === workout.id ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Importar
                      </>
                    )}
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
