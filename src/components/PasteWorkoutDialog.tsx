import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardPaste, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useStore } from "@/hooks/use-store";
import { createExerciseAssignmentFromLibrary } from "@/lib/exercise-utils";
import {
  conferirComBiblioteca,
  contarEncontrados,
  contarNaoEncontrados,
  lerTreinoDeTexto,
} from "@/lib/workout-import";
import type { WorkoutBlock } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  /** Aplica os blocos montados. Quem chama decide como persistir. */
  onApply: (dados: {
    blocos: WorkoutBlock[];
    estrutura: "weekly" | "abcde" | null;
    metaSemanal: number | null;
  }) => Promise<void>;
}

const EXEMPLO = `Estrutura: ABCDE
Meta semanal: 4

Treino A — Peito e tríceps
- Supino reto com barra | 4x8 | 40kg | 90s | descer controlado
- Crucifixo reto | 3x12 | 14kg | 60s
- Tríceps corda | 3x15 | 25kg | 45s`;

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function PasteWorkoutDialog({ open, onOpenChange, studentId, onApply }: Props) {
  const { exerciseLibrary } = useStore();
  const [texto, setTexto] = useState("");
  const [aplicando, setAplicando] = useState(false);

  const lido = useMemo(() => (texto.trim() ? lerTreinoDeTexto(texto) : null), [texto]);
  const conferido = useMemo(
    () => (lido ? conferirComBiblioteca(lido.blocos, exerciseLibrary) : []),
    [lido, exerciseLibrary],
  );

  const encontrados = contarEncontrados(conferido);
  const naoEncontrados = contarNaoEncontrados(conferido);
  const podeAplicar = encontrados > 0 && naoEncontrados === 0 && !aplicando;

  const handleAplicar = async () => {
    if (!lido) return;

    // Só entra exercício que casou com a biblioteca — a ficha técnica vem de lá,
    // não do texto colado.
    const blocos: WorkoutBlock[] = conferido.map((bloco, indice) => ({
      id: gerarId(),
      name: bloco.nome,
      orderIndex: indice,
      exercises: bloco.exercicios
        .filter((e) => e.daBiblioteca)
        .map((e) => ({
          ...createExerciseAssignmentFromLibrary(e.daBiblioteca!),
          sets: e.lido.series,
          reps: e.lido.reps,
          load: e.lido.carga,
          rest: e.lido.descanso,
          notes: e.lido.observacao,
        })),
    }));

    setAplicando(true);
    try {
      await onApply({ blocos, estrutura: lido.estrutura, metaSemanal: lido.metaSemanal });
      toast.success("Treino importado do texto.");
      setTexto("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível aplicar o treino.");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!aplicando) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Colar treino</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cole a prescrição em texto. Só entram exercícios que existem na biblioteca —
            ficha técnica, músculos e mídia continuam vindo de lá.
          </p>

          <Textarea
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder={EXEMPLO}
            rows={10}
            className="font-mono text-xs"
            disabled={aplicando}
          />

          {!texto.trim() ? (
            <button
              type="button"
              onClick={() => setTexto(EXEMPLO)}
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              Preencher com um exemplo
            </button>
          ) : null}

          {lido ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {encontrados} encontrado{encontrados === 1 ? "" : "s"}
                </span>
                {naoEncontrados > 0 ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {naoEncontrados} não encontrado{naoEncontrados === 1 ? "" : "s"}
                  </span>
                ) : null}
                <span className="text-muted-foreground">
                  {conferido.length} bloco{conferido.length === 1 ? "" : "s"}
                  {lido.estrutura ? ` · ${lido.estrutura === "abcde" ? "ABCDE" : "Weekly"}` : ""}
                  {lido.metaSemanal ? ` · meta ${lido.metaSemanal}` : ""}
                </span>
              </div>

              {lido.avisos.map((aviso) => (
                <p key={aviso} className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                  {aviso}
                </p>
              ))}

              <div className="space-y-3">
                {conferido.map((bloco) => (
                  <div key={bloco.nome} className="rounded-[20px] border border-border/60 bg-background/70 p-4">
                    <p className="text-sm font-semibold">{bloco.nome}</p>
                    <ul className="mt-2 space-y-1.5">
                      {bloco.exercicios.map((item) => (
                        <li key={`${item.lido.linha}-${item.lido.nome}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                          {item.daBiblioteca ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-success" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-destructive" />
                          )}
                          <span className={item.daBiblioteca ? "font-medium" : "font-medium text-destructive"}>
                            {item.lido.nome}
                          </span>
                          <span className="text-muted-foreground">
                            {item.lido.series}x{item.lido.reps}
                            {item.lido.carga ? ` · ${item.lido.carga}` : ""}
                            {item.lido.descanso ? ` · ${item.lido.descanso}` : ""}
                          </span>
                          {!item.daBiblioteca ? (
                            <span className="w-full text-destructive/90">
                              Linha {item.lido.linha}: não existe na biblioteca.
                              {item.sugestao ? ` Você quis dizer "${item.sugestao}"?` : ""}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {naoEncontrados > 0 ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-foreground">
                  Corrija os nomes marcados antes de aplicar. Não substituo por parecido:
                  exercício trocado no treino do aluno é pior do que faltar um.
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter className="border-t border-border/60 bg-background/95">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={aplicando}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleAplicar} disabled={!podeAplicar}>
            {aplicando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando...
              </>
            ) : (
              <>
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Aplicar ao aluno
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
