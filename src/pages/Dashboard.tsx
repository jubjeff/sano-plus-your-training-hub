import { useStore } from "@/hooks/use-store";
import { Users, UserCheck, UserX, RefreshCw, Clock, ArrowRight, Dumbbell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDate, getInitials, getRelativeWorkoutLabel } from "@/lib/format";

export default function Dashboard() {
  const { students, workouts } = useStore();
  const navigate = useNavigate();

  const totalStudents = students.length;
  const activeStudents = students.filter((student) => student.active).length;
  const inactiveStudents = students.filter((student) => !student.active).length;

  const needsWorkoutChange = students
    .filter((student) => student.active && student.nextWorkoutChange)
    .sort((a, b) => (a.nextWorkoutChange || "").localeCompare(b.nextWorkoutChange || ""))
    .slice(0, 5);

  const recentStudents = [...students]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 5);

  const stats = [
    { label: "Total de alunos", value: totalStudents, icon: Users, tone: "text-primary" },
    { label: "Alunos ativos", value: activeStudents, icon: UserCheck, tone: "text-success" },
    { label: "Alunos inativos", value: inactiveStudents, icon: UserX, tone: "text-destructive" },
    { label: "Treinos prontos", value: workouts.length, icon: Dumbbell, tone: "text-accent" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="section-shell overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-8">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Dashboard
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">Visão geral da sua operação</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Priorize alunos que precisam de atenção, acompanhe a cadência de troca de treinos e mantenha o fluxo diário do Sano+ sob controle.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Foco de hoje</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{needsWorkoutChange.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">alunos com revisão próxima de treino</p>
            <button
              onClick={() => navigate("/alunos")}
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Abrir painel de alunos
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="metric-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-background/80 ${stat.tone}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="section-shell p-6 lg:p-7">
          <div className="mb-5 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-warning" />
            <h2 className="font-display text-xl font-semibold">Trocas de treino</h2>
          </div>

          {needsWorkoutChange.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno precisa de troca no momento.</p>
          ) : (
            <div className="space-y-3">
              {needsWorkoutChange.map((student) => (
                <button
                  key={student.id}
                  onClick={() => navigate(`/alunos/${student.id}`)}
                  className="flex w-full items-center justify-between rounded-[22px] border border-border/60 bg-background/70 px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-muted/60"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold text-primary">
                      {getInitials(student.name)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.objective}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-semibold text-foreground">
                    {getRelativeWorkoutLabel(student.nextWorkoutChange)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="section-shell p-6 lg:p-7">
          <div className="mb-5 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">Novos alunos</h2>
          </div>
          <div className="space-y-3">
            {recentStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => navigate(`/alunos/${student.id}`)}
                className="flex w-full items-center justify-between rounded-[22px] border border-border/60 bg-background/70 px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-muted/60"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold text-primary">
                    {getInitials(student.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{student.name}</p>
                    <p className="text-xs text-muted-foreground">Entrou em {formatDate(student.startDate)}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {student.active ? "Ativo" : "Inativo"}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
