import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ExerciseResultCard from "@/components/ExerciseResultCard";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { mapCatalogItemToExercise, mapExerciseDbToCatalogItem } from "@/lib/exercisedb-mappers";
import {
  getExerciseDbExerciseById,
  listExerciseDbBodyParts,
  listExerciseDbEquipment,
  listExerciseDbTargets,
  searchExerciseDbExercises,
} from "@/services/exercisedb.service";
import { Exercise } from "@/types";
import { SanoExerciseCatalogItem } from "@/types/exercisedb";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExercise: (exercise: Exercise) => void;
}

const ALL = "all";

export default function ExerciseSearchDialog({ open, onOpenChange, onSelectExercise }: Props) {
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState(ALL);
  const [target, setTarget] = useState(ALL);
  const [equipment, setEquipment] = useState(ALL);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 350);

  const normalizedFilters = useMemo(
    () => ({
      query: debouncedQuery.trim(),
      bodyPart: bodyPart === ALL ? undefined : bodyPart,
      target: target === ALL ? undefined : target,
      equipment: equipment === ALL ? undefined : equipment,
    }),
    [bodyPart, debouncedQuery, equipment, target],
  );

  const bodyPartsQuery = useQuery({
    queryKey: ["exercisedb", "bodyParts"],
    queryFn: listExerciseDbBodyParts,
    staleTime: 1000 * 60 * 60,
  });

  const targetsQuery = useQuery({
    queryKey: ["exercisedb", "targets"],
    queryFn: listExerciseDbTargets,
    staleTime: 1000 * 60 * 60,
  });

  const equipmentQuery = useQuery({
    queryKey: ["exercisedb", "equipment"],
    queryFn: listExerciseDbEquipment,
    staleTime: 1000 * 60 * 60,
  });

  const exercisesQuery = useQuery({
    queryKey: ["exercisedb", "search", normalizedFilters],
    queryFn: () => searchExerciseDbExercises(normalizedFilters),
    enabled: open,
    staleTime: 1000 * 60 * 10,
    placeholderData: (previous) => previous,
  });

  const handleSelectExercise = async (item: SanoExerciseCatalogItem) => {
    setSelectionError(null);

    try {
      const details = await getExerciseDbExerciseById(item.externalId);
      const normalized = details ? mapExerciseDbToCatalogItem(details) : item;
      onSelectExercise(mapCatalogItemToExercise(normalized));
      onOpenChange(false);
    } catch {
      setSelectionError("Não foi possível importar esse exercício agora. Você ainda pode criar o exercício manualmente.");
    }
  };

  const showFallbackBanner = Boolean(
    exercisesQuery.data?.usedFallback ||
    bodyPartsQuery.data?.usedFallback ||
    targetsQuery.data?.usedFallback ||
    equipmentQuery.data?.usedFallback,
  );

  const fallbackReason =
    exercisesQuery.data?.fallbackReason ||
    bodyPartsQuery.data?.fallbackReason ||
    targetsQuery.data?.fallbackReason ||
    equipmentQuery.data?.fallbackReason ||
    null;

  const fallbackMessage = fallbackReason?.toLowerCase().includes("not configured")
    ? "A chave da ExerciseDB ainda não foi configurada no ambiente local. O Sano+ está mostrando resultados de fallback."
    : "A ExerciseDB está indisponível no momento. O Sano+ exibiu resultados de fallback para manter seu fluxo funcionando.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-display">Adicionar exercício da ExerciseDB</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-[24px] border border-border/60 bg-background/60 p-4">
            <div className="space-y-2">
              <Label htmlFor="exercise-search">Pesquisar por nome</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="exercise-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex: bench press, squat..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Body part</Label>
              <Select value={bodyPart} onValueChange={setBodyPart}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {(bodyPartsQuery.data?.items ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Músculo alvo</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {(targetsQuery.data?.items ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Equipamento</Label>
              <Select value={equipment} onValueChange={setEquipment}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {(equipmentQuery.data?.items ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
              O exercício importado já entra com nome, mídia, body part, músculo alvo, equipamento e contexto didático quando disponível.
            </div>
          </aside>

          <section className="space-y-4">
            {showFallbackBanner && (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
                {fallbackMessage}
              </div>
            )}

            {selectionError && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {selectionError}
              </div>
            )}

            {exercisesQuery.isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-[24px] border border-border/60 p-4">
                    <div className="flex gap-4">
                      <Skeleton className="h-24 w-24 rounded-[18px]" />
                      <div className="flex-1 space-y-3">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : exercisesQuery.isError ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[24px] border border-border/60 bg-background/60 p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-medium">Não foi possível consultar a ExerciseDB agora.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Você ainda pode continuar criando exercícios manualmente normalmente.</p>
                </div>
                <Button variant="outline" onClick={() => exercisesQuery.refetch()}>Tentar novamente</Button>
              </div>
            ) : (exercisesQuery.data?.items.length ?? 0) === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[24px] border border-border/60 bg-background/60 p-8 text-center">
                <Search className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">Nenhum exercício encontrado</p>
                  <p className="mt-1 text-sm text-muted-foreground">Tente outro termo de busca ou ajuste os filtros.</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[60vh] pr-3">
                <div className="grid gap-3">
                  {(exercisesQuery.data?.items ?? []).map((exercise) => (
                    <ExerciseResultCard key={exercise.externalId} exercise={exercise} onSelect={handleSelectExercise} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
