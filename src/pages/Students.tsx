import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/hooks/use-store";
import { Search, Plus, UserCheck, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StudentFormDialog from "@/components/StudentFormDialog";

type Filter = "all" | "active" | "inactive";

export default function Students() {
  const { students } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = students.filter((s) => {
    if (filter === "active" && !s.active) return false;
    if (filter === "inactive" && s.active) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filters: { key: Filter; label: string; icon: React.ElementType }[] = [
    { key: "all", label: "Todos", icon: Users },
    { key: "active", label: "Ativos", icon: UserCheck },
    { key: "inactive", label: "Inativos", icon: UserX },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Alunos</h1>
          <p className="text-sm text-muted-foreground">{students.length} alunos cadastrados</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Aluno
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <f.icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum aluno encontrado</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((student) => (
            <div
              key={student.id}
              onClick={() => navigate(`/alunos/${student.id}`)}
              className="group cursor-pointer rounded-xl bg-card border p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                  {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{student.name}</h3>
                    <span className={`shrink-0 inline-block h-2 w-2 rounded-full ${
                      student.active ? "bg-success" : "bg-muted-foreground"
                    }`} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{student.objective}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Início: {new Date(student.startDate).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <StudentFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
