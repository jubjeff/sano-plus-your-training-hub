import { useState } from "react";
import { useStore } from "@/hooks/use-store";
import { Plus, Dumbbell, Copy, Trash2, Edit, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WorkoutFormDialog from "@/components/WorkoutFormDialog";
import { Workout } from "@/types";

export default function WorkoutLibrary() {
  const { workouts, deleteWorkout, duplicateWorkout } = useStore();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | undefined>();

  const filtered = workouts.filter((w) =>
    search ? w.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const openEdit = (w: Workout) => {
    setEditingWorkout(w);
    setFormOpen(true);
  };

  const openNew = () => {
    setEditingWorkout(undefined);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Biblioteca de Treinos</h1>
          <p className="text-sm text-muted-foreground">{workouts.length} treinos salvos</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Treino
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar treino..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum treino encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <div key={w.id} className="rounded-xl bg-card border p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">{w.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{w.objective}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(w)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateWorkout(w.id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteWorkout(w.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {w.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{w.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {w.blocks.map((b) => (
                  <span key={b.id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {b.name} ({b.exercises.length})
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Criado em {new Date(w.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}

      <WorkoutFormDialog open={formOpen} onOpenChange={setFormOpen} workout={editingWorkout} />
    </div>
  );
}
