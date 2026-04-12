import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { Exercise } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MUSCLE_CATEGORIES, MUSCLE_GROUP_OPTIONS } from "@/lib/exercise-options";
import { cloneExerciseForAssignment, collectUniqueExercisesFromWorkouts, getExerciseDescription } from "@/lib/exercise-utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExercise: (exercise: Exercise) => void;
}

const ALL = "all";

export default function ExerciseLibraryPickerDialog({ open, onOpenChange, onSelectExercise }: Props) {
  const { workouts } = useStore();
  const [query, setQuery] = useState("");
  const [muscleCategory, setMuscleCategory] = useState(ALL);
  const [musclePrimary, setMusclePrimary] = useState(ALL);

  const libraryExercises = useMemo(() => collectUniqueExercisesFromWorkouts(workouts), [workouts]);

  const filteredExercises = useMemo(
    () =>
      libraryExercises.filter((exercise) => {
        const matchesQuery =
          !query ||
          exercise.name.toLowerCase().includes(query.toLowerCase()) ||
          getExerciseDescription(exercise).toLowerCase().includes(query.toLowerCase());
        const matchesCategory = muscleCategory === ALL || exercise.muscleCategory === muscleCategory;
        const matchesPrimary = musclePrimary === ALL || exercise.muscleGroupPrimary === musclePrimary;
        return matchesQuery && matchesCategory && matchesPrimary;
      }),
    [libraryExercises, muscleCategory, musclePrimary, query],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-display">Adicionar exercício da biblioteca</DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-[24px] border border-border/60 bg-background/60 p-4">
            <div className="space-y-2">
              <Label htmlFor="exercise-library-search">Buscar exercício</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="exercise-library-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex: agachamento, remada..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria geral</Label>
              <Select value={muscleCategory} onValueChange={setMuscleCategory}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {MUSCLE_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Musculatura principal</Label>
              <Select value={musclePrimary} onValueChange={setMusclePrimary}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {MUSCLE_GROUP_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </aside>

          <section>
            {filteredExercises.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-border/60 bg-background/60 p-8 text-center">
                <p className="font-medium">Nenhum exercício encontrado na sua biblioteca</p>
                <p className="mt-2 text-sm text-muted-foreground">Cadastre exercícios manualmente em um treino e eles passam a aparecer aqui para reutilização.</p>
              </div>
            ) : (
              <ScrollArea className="h-[min(60vh,28rem)] pr-3">
                <div className="grid gap-3">
                  {filteredExercises.map((exercise) => (
                    <article key={exercise.id} className="rounded-[24px] border border-border/60 bg-background/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold">{exercise.name}</h3>
                          {getExerciseDescription(exercise) && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{getExerciseDescription(exercise)}</p>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {exercise.muscleCategory && <Badge variant="outline">{exercise.muscleCategory}</Badge>}
                            {exercise.muscleGroupPrimary && <Badge variant="secondary" className="bg-primary/10 text-primary">{exercise.muscleGroupPrimary}</Badge>}
                            {(exercise.muscleGroupsSecondary ?? []).slice(0, 2).map((item) => (
                              <Badge key={`${exercise.id}-${item}`} variant="outline">{item}</Badge>
                            ))}
                            {exercise.equipment && <Badge variant="outline">{exercise.equipment}</Badge>}
                            {(exercise.videoFileUrl || exercise.videoStorageKey) && <Badge variant="outline">MP4</Badge>}
                            {exercise.youtubeEmbedUrl && <Badge variant="outline">YouTube</Badge>}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => {
                            onSelectExercise(cloneExerciseForAssignment(exercise));
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
