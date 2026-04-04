import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/hooks/use-store";
import { Search, Plus, UserCheck, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StudentFormDialog from "@/components/StudentFormDialog";
import { formatDate, getInitials } from "@/lib/format";

type Filter = "all" | "active" | "inactive";

export default function Students() {
  const { students } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = students.filter((student) => {
    if (filter === "active" && !student.active) return false;
    if (filter === "inactive" && student.active) return false;
    if (search && !student.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filters: { key: Filter; label: string; icon: React.ElementType }[] = [
    { key: "all", label: "Todos", icon: Users },
    { key: "active", label: "Ativos", icon: UserCheck },
    { key: "inactive", label: "Inativos", icon: UserX },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="section-shell overflow-hidden">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div>
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Alunos
            </span>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Gestão de carteira e acompanhamento</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Centralize busca, status e acesso rápido ao perfil de cada aluno em um painel com leitura imediata.
            </p>
          </div>
          <Button className="min-w-40" onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo aluno
          </Button>
        </div>
      </section>

      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Base de alunos</h2>
        <p className="text-sm text-muted-foreground">{students.length} alunos cadastrados</p>
      </div>

      <section className="section-shell p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-2xl border-border/70 bg-background/70 pl-9"
            />
          </div>
          <div className="flex gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1">
            {filters.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  filter === item.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="section-shell py-16 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p>Nenhum aluno encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((student) => (
            <div
              key={student.id}
              onClick={() => navigate(`/alunos/${student.id}`)}
              className="section-shell group cursor-pointer p-5 transition-all hover:border-primary/30"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-primary/12 text-lg font-bold text-primary">
                  {getInitials(student.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold">{student.name}</h3>
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${student.active ? "bg-success" : "bg-muted-foreground"}`} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{student.objective}</p>
                  <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>Início: {formatDate(student.startDate)}</span>
                    <span>{student.email || "Sem e-mail cadastrado"}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {student.active ? "Ativo" : "Inativo"}
                    </span>
                    <span className="text-sm font-medium text-primary transition-colors group-hover:text-primary/80">
                      Abrir perfil
                    </span>
                  </div>
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
