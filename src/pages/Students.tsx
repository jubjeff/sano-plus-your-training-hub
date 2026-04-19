import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailCheck, Plus, Search, UserCheck, UserMinus, Users } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StudentFormDialog from "@/components/StudentFormDialog";
import { formatDate, getInitials } from "@/lib/format";
import { getStudentAccessStatusLabel, getStudentAccessTone } from "@/lib/student-access";
import type { StudentAccessStatus } from "@/types";

type Filter = "all" | StudentAccessStatus;

export default function Students() {
  const { students } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = students.filter((student) => {
    if (filter !== "all" && student.accessStatus !== filter) return false;
    if (search && !student.fullName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filters: { key: Filter; label: string; icon: React.ElementType }[] = [
    { key: "all", label: "Todos", icon: Users },
    { key: "temporary_password_pending", label: "Primeiro acesso pendente", icon: MailCheck },
    { key: "active", label: "Conta ativa", icon: UserCheck },
    { key: "inactive", label: "Inativos", icon: UserMinus },
  ];

  return (
    <div className="page-shell">
      <section className="section-shell overflow-hidden">
        <div className="page-header p-5 sm:p-6 lg:p-8">
          <div>
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Alunos
            </span>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Cadastro controlado com senha provisória</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Crie contas de aluno com Supabase Auth, envie o acesso inicial por e-mail e acompanhe quem ainda precisa concluir o primeiro login.
            </p>
          </div>
          <Button className="w-full sm:w-auto sm:min-w-40" onClick={() => setFormOpen(true)}>
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
          <div className="flex flex-wrap gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1">
            {filters.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  filter === item.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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
                  {getInitials(student.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold">{student.fullName}</h3>
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${student.studentStatus === "active" ? "bg-success" : "bg-destructive"}`} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{student.goal}</p>
                  <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>Criado em: {formatDate(student.createdAt)}</span>
                    <span>{student.email || "Sem e-mail cadastrado"}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStudentAccessTone(student.accessStatus)}`}>
                      {getStudentAccessStatusLabel(student.accessStatus)}
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
