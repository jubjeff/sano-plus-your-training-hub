import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/hooks/use-store";
import { Plus, Dumbbell, Copy, Trash2, Edit, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WorkoutFormDialog from "@/components/WorkoutFormDialog";
import { Workout } from "@/types";
import { formatDate } from "@/lib/format";

export default function WorkoutLibrary() {
  const { workouts, deleteWorkout, duplicateWorkout } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | undefined>();

  const filtered = workouts.filter((workout) =>
    search ? workout.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const openEdit = (workout: Workout) => {
    setEditingWorkout(workout);
    setFormOpen(true);
  };

  const openNew = () => {
    setEditingWorkout(undefined);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="section-shell overflow-hidden">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div>
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Biblioteca
            </span>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Treinos reutilizáveis com cara de produto</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Mantenha treinos prontos para importar, duplicar e editar com mais profundidade quando precisar.
            </p>
          </div>
          <Button className="min-w-40" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo treino
          </Button>
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
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background/70 pl-9"
          />
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="section-shell py-16 text-center text-muted-foreground">
          <Dumbbell className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p>Nenhum treino encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((workout) => (
            <div key={workout.id} className="section-shell p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{workout.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{workout.objective}</p>
                </div>
                <div className="flex shrink-0 gap-1">
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

              <div className="mt-5 flex items-center justify-between">
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

      <WorkoutFormDialog open={formOpen} onOpenChange={setFormOpen} workout={editingWorkout} />
    </div>
  );
}
