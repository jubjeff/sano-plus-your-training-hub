import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Copy, Dumbbell, Edit, Plus, Search, Trash2, Video } from "lucide-react";
import { useAuth } from "@/auth/use-auth";
import { useStore } from "@/hooks/use-store";
import { ExerciseLibraryItem, Workout } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WorkoutFormDialog from "@/components/WorkoutFormDialog";
import ExerciseEditorDialog from "@/components/ExerciseEditorDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_DIFFICULTY_OPTIONS,
  EXERCISE_EQUIPMENT_SUGGESTIONS,
  EXERCISE_MOVEMENT_OPTIONS,
  MUSCLE_GROUP_OPTIONS,
} from "@/lib/exercise-options";
import { matchesExerciseQuery } from "@/lib/exercise-utils";
import { formatDate } from "@/lib/format";

const ALL = "all";

export default function WorkoutLibrary() {
  const { user } = useAuth();
  const {
    workouts,
    exerciseLibrary,
    deleteWorkout,
    duplicateWorkout,
    addExerciseLibraryItem,
    updateExerciseLibraryItem,
    setExerciseLibraryItemActive,
  } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseCategory, setExerciseCategory] = useState(ALL);
  const [exercisePrimary, setExercisePrimary] = useState(ALL);
  const [exerciseEquipment, setExerciseEquipment] = useState(ALL);
  const [exerciseDifficulty, setExerciseDifficulty] = useState(ALL);
  const [exerciseMovement, setExerciseMovement] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | undefined>();
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseLibraryItem | undefined>();
  const canManageExerciseLibrary = user?.role === "coach" && user.platformRole === "dev_admin";

  const filteredWorkouts = workouts.filter((workout) =>
    search ? workout.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const filteredExercises = useMemo(
    () =>
      exerciseLibrary.filter((exercise) => {
        const matchesCategory = exerciseCategory === ALL || exercise.category === exerciseCategory;
        const matchesPrimary = exercisePrimary === ALL || exercise.muscleGroupPrimary === exercisePrimary;
        const matchesEquipment = exerciseEquipment === ALL || exercise.equipment === exerciseEquipment;
        const matchesDifficulty = exerciseDifficulty === ALL || exercise.difficultyLevel === exerciseDifficulty;
        const matchesMovement = exerciseMovement === ALL || exercise.movementType === exerciseMovement;
        return (
          matchesCategory &&
          matchesPrimary &&
          matchesEquipment &&
          matchesDifficulty &&
          matchesMovement &&
          matchesExerciseQuery(exercise, exerciseSearch)
        );
      }),
    [exerciseCategory, exerciseDifficulty, exerciseEquipment, exerciseLibrary, exerciseMovement, exercisePrimary, exerciseSearch],
  );

  const openEdit = (workout: Workout) => {
    setEditingWorkout(workout);
    setFormOpen(true);
  };

  const openNew = () => {
    setEditingWorkout(undefined);
    setFormOpen(true);
  };

  const openNewExercise = () => {
    setEditingExercise(undefined);
    setExerciseDialogOpen(true);
  };

  const openEditExercise = (exercise: ExerciseLibraryItem) => {
    setEditingExercise(exercise);
    setExerciseDialogOpen(true);
  };

  return (
    <div className="page-shell">
      <section className="section-shell overflow-hidden">
        <div className="page-header p-5 sm:p-6 lg:p-8">
          <div>
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Biblioteca
            </span>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Treinos reutilizaveis e catalogo global de exercicios</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              O Sano+ usa uma biblioteca oficial de exercicios compartilhada entre todos os professores, pronta para busca, filtros e evolucao gradual com videos.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {canManageExerciseLibrary ? (
              <Button variant="outline" className="w-full sm:w-auto" onClick={openNewExercise}>
                <Plus className="mr-2 h-4 w-4" />
                Novo exercicio
              </Button>
            ) : null}
            <Button className="w-full sm:w-auto sm:min-w-40" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo treino
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="section-shell p-5">
          <p className="text-sm text-muted-foreground">Treinos reutilizaveis</p>
          <p className="mt-2 font-display text-3xl font-semibold">{workouts.length}</p>
        </div>
        <div className="section-shell p-5">
          <p className="text-sm text-muted-foreground">Exercicios globais</p>
          <p className="mt-2 font-display text-3xl font-semibold">{exerciseLibrary.length}</p>
        </div>
        <div className="section-shell p-5">
          <p className="text-sm text-muted-foreground">Exercicios com video</p>
          <p className="mt-2 font-display text-3xl font-semibold">{exerciseLibrary.filter((item) => item.videoUrl).length}</p>
        </div>
      </section>

      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Biblioteca de treinos</h2>
        <p className="text-sm text-muted-foreground">{workouts.length} treinos salvos</p>
      </div>

      <section className="section-shell p-5 lg:p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar treino..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background/70 pl-9"
          />
        </div>
      </section>

      {filteredWorkouts.length === 0 ? (
        <div className="section-shell py-16 text-center text-muted-foreground">
          <Dumbbell className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p>Nenhum treino encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredWorkouts.map((workout) => (
            <div key={workout.id} className="section-shell p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{workout.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{workout.objective}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(workout)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateWorkout(workout.id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteWorkout(workout.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {workout.notes && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{workout.notes}</p>}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {workout.blocks.map((block) => (
                  <span key={block.id} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                    {block.name} ({block.exercises.length})
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Criado em {formatDate(workout.createdAt)}</p>
                <button
                  onClick={() => navigate(`/biblioteca/${workout.id}/editar`)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Editor completo
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="section-shell p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Biblioteca global de exercicios</h2>
            <p className="text-sm text-muted-foreground">Base central do Sano+ com filtros, video opcional e ficha tecnica padronizada.</p>
          </div>
          {canManageExerciseLibrary ? (
            <Button onClick={openNewExercise}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar exercicio
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px] xl:grid-cols-[minmax(0,1fr)_220px_220px_220px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={exerciseSearch} onChange={(event) => setExerciseSearch(event.target.value)} placeholder="Buscar exercicio..." className="pl-9" />
          </div>
          <Select value={exerciseCategory} onValueChange={setExerciseCategory}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              {EXERCISE_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={exercisePrimary} onValueChange={setExercisePrimary}>
            <SelectTrigger><SelectValue placeholder="Grupo principal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os grupos</SelectItem>
              {MUSCLE_GROUP_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={exerciseEquipment} onValueChange={setExerciseEquipment}>
            <SelectTrigger><SelectValue placeholder="Equipamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os equipamentos</SelectItem>
              {EXERCISE_EQUIPMENT_SUGGESTIONS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={exerciseDifficulty} onValueChange={setExerciseDifficulty}>
            <SelectTrigger><SelectValue placeholder="Nivel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os niveis</SelectItem>
              {EXERCISE_DIFFICULTY_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={exerciseMovement} onValueChange={setExerciseMovement}>
            <SelectTrigger><SelectValue placeholder="Movimento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os movimentos</SelectItem>
              {EXERCISE_MOVEMENT_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredExercises.length === 0 ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-border/60 px-4 py-12 text-center text-muted-foreground">
            Nenhum exercicio encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {filteredExercises.map((exercise) => (
              <article key={exercise.id} className="rounded-[24px] border border-border/60 bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{exercise.name}</h3>
                      <Badge variant={exercise.isActive ? "outline" : "secondary"}>{exercise.isActive ? "Ativo" : "Inativo"}</Badge>
                      {exercise.videoUrl && (
                        <Badge variant="outline" className="gap-1">
                          <Video className="h-3 w-3" />
                          MP4
                        </Badge>
                      )}
                    </div>
                    {exercise.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{exercise.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{exercise.category}</Badge>
                      {exercise.muscleGroupPrimary && <Badge variant="secondary" className="bg-primary/10 text-primary">{exercise.muscleGroupPrimary}</Badge>}
                      {(exercise.muscleGroupsSecondary ?? []).slice(0, 2).map((item) => <Badge key={`${exercise.id}-${item}`} variant="outline">{item}</Badge>)}
                      {exercise.equipment && <Badge variant="outline">{exercise.equipment}</Badge>}
                      {exercise.difficultyLevel && <Badge variant="outline">{exercise.difficultyLevel}</Badge>}
                      {exercise.movementType && <Badge variant="outline">{exercise.movementType}</Badge>}
                      {exercise.movementCategory && <Badge variant="outline">{exercise.movementCategory}</Badge>}
                      {exercise.mechanicalType && <Badge variant="outline">{exercise.mechanicalType}</Badge>}
                      {exercise.laterality && <Badge variant="outline">{exercise.laterality}</Badge>}
                      {exercise.movementPlane && <Badge variant="outline">{exercise.movementPlane}</Badge>}
                    </div>
                    {(exercise.aliases ?? []).length > 0 && (
                      <p className="mt-3 text-xs text-muted-foreground">Aliases: {exercise.aliases.join(", ")}</p>
                    )}
                    <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        <p className="font-medium text-foreground">Execucao</p>
                        <p className="line-clamp-2">{exercise.executionInstructions || "Sem instrucoes detalhadas."}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Erros comuns</p>
                        <p className="line-clamp-2">{exercise.commonMistakes || "Sem erros comuns cadastrados."}</p>
                      </div>
                    </div>
                  </div>

                  {canManageExerciseLibrary ? (
                    <div className="flex flex-col gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditExercise(exercise)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setExerciseLibraryItemActive(exercise.id, !exercise.isActive)}>
                        {exercise.isActive ? "Inativar" : "Ativar"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <WorkoutFormDialog open={formOpen} onOpenChange={setFormOpen} workout={editingWorkout} />

      {canManageExerciseLibrary ? (
        <ExerciseEditorDialog
          open={exerciseDialogOpen}
          onOpenChange={setExerciseDialogOpen}
          exercise={editingExercise}
          onSave={async ({ exercise, videoFile, removeVideo }) => {
            if (editingExercise) {
              await updateExerciseLibraryItem(editingExercise.id, {
                ...exercise,
                videoFile,
                removeVideo,
              });
              return;
            }

            await addExerciseLibraryItem({
              ...exercise,
              videoFile,
              removeVideo,
            });
          }}
        />
      ) : null}
    </div>
  );
}
