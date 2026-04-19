import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { ExerciseLibraryItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_DIFFICULTY_OPTIONS,
  EXERCISE_EQUIPMENT_SUGGESTIONS,
  EXERCISE_MOVEMENT_OPTIONS,
  MUSCLE_GROUP_OPTIONS,
} from "@/lib/exercise-options";
import { matchesExerciseQuery } from "@/lib/exercise-utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExercise: (exercise: ExerciseLibraryItem) => void;
}

const ALL = "all";

export default function ExerciseLibraryPickerDialog({ open, onOpenChange, onSelectExercise }: Props) {
  const { exerciseLibrary } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [primaryGroup, setPrimaryGroup] = useState(ALL);
  const [equipment, setEquipment] = useState(ALL);
  const [difficulty, setDifficulty] = useState(ALL);
  const [movementType, setMovementType] = useState(ALL);

  const filteredExercises = useMemo(
    () =>
      exerciseLibrary.filter((exercise) => {
        if (!exercise.isActive) return false;
        const matchesCategory = category === ALL || exercise.category === category;
        const matchesPrimary = primaryGroup === ALL || exercise.muscleGroupPrimary === primaryGroup;
        const matchesEquipment = equipment === ALL || exercise.equipment === equipment;
        const matchesDifficulty = difficulty === ALL || exercise.difficultyLevel === difficulty;
        const matchesMovement = movementType === ALL || exercise.movementType === movementType;
        return (
          matchesCategory &&
          matchesPrimary &&
          matchesEquipment &&
          matchesDifficulty &&
          matchesMovement &&
          matchesExerciseQuery(exercise, query)
        );
      }),
    [category, difficulty, equipment, exerciseLibrary, movementType, primaryGroup, query],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="font-display">Adicionar exercício da biblioteca global</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
            <aside className="space-y-4 rounded-[24px] border border-border/60 bg-background/60 p-4">
              <div className="space-y-2">
                <Label htmlFor="exercise-library-search">Buscar exercício</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="exercise-library-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ex.: agachamento, mobilidade torácica..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {EXERCISE_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Grupo muscular principal</Label>
                <Select value={primaryGroup} onValueChange={setPrimaryGroup}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {MUSCLE_GROUP_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
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
                    {EXERCISE_EQUIPMENT_SUGGESTIONS.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nível</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {EXERCISE_DIFFICULTY_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de movimento</Label>
                <Select value={movementType} onValueChange={setMovementType}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {EXERCISE_MOVEMENT_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </aside>

            <section>
              {filteredExercises.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-border/60 bg-background/60 p-8 text-center">
                  <p className="font-medium">Nenhum exercício encontrado</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ajuste os filtros ou cadastre um novo exercício na biblioteca global.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[min(60vh,32rem)] pr-3">
                  <div className="grid gap-3">
                    {filteredExercises.map((exercise) => (
                      <article key={exercise.id} className="rounded-[24px] border border-border/60 bg-background/70 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold">{exercise.name}</h3>
                              <Badge variant="outline">{exercise.category}</Badge>
                              {exercise.videoUrl && <Badge variant="outline">MP4</Badge>}
                            </div>
                            {exercise.description && (
                              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{exercise.description}</p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {exercise.muscleGroupPrimary && <Badge variant="secondary" className="bg-primary/10 text-primary">{exercise.muscleGroupPrimary}</Badge>}
                              {(exercise.muscleGroupsSecondary ?? []).slice(0, 2).map((item) => (
                                <Badge key={`${exercise.id}-${item}`} variant="outline">{item}</Badge>
                              ))}
                              {exercise.equipment && <Badge variant="outline">{exercise.equipment}</Badge>}
                              {exercise.difficultyLevel && <Badge variant="outline">{exercise.difficultyLevel}</Badge>}
                              {exercise.movementType && <Badge variant="outline">{exercise.movementType}</Badge>}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => {
                              onSelectExercise(exercise);
                              onOpenChange(false);
                            }}
                          >
                            Adicionar
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </section>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
