import { useStore } from "@/hooks/use-store";
import { Users, UserCheck, UserX, RefreshCw, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { students } = useStore();
  const navigate = useNavigate();

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.active).length;
  const inactiveStudents = students.filter((s) => !s.active).length;

  const needsWorkoutChange = students
    .filter((s) => s.active && s.nextWorkoutChange)
    .sort((a, b) => (a.nextWorkoutChange || "").localeCompare(b.nextWorkoutChange || ""))
    .slice(0, 5);

  const recentStudents = [...students]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 5);

  const stats = [
    { label: "Total de Alunos", value: totalStudents, icon: Users, color: "text-primary" },
    { label: "Ativos", value: activeStudents, icon: UserCheck, color: "text-success" },
    { label: "Inativos", value: inactiveStudents, icon: UserX, color: "text-destructive" },
  ];

  const daysUntil = (dateStr?: string) => {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Bem-vindo ao Sano Plus</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl bg-card border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`h-10 w-10 ${stat.color} opacity-80`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Workout change alerts */}
        <div className="rounded-xl bg-card border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-5 w-5 text-warning" />
            <h2 className="font-display font-semibold">Troca de Treino</h2>
          </div>
          {needsWorkoutChange.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno precisa de troca no momento.</p>
          ) : (
            <div className="space-y-3">
              {needsWorkoutChange.map((s) => {
                const days = daysUntil(s.nextWorkoutChange);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/alunos/${s.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {s.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      days !== null && days <= 3
                        ? "bg-destructive/10 text-destructive"
                        : days !== null && days <= 7
                        ? "bg-warning/10 text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {days !== null ? (days <= 0 ? "Hoje!" : `${days} dias`) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent students */}
        <div className="rounded-xl bg-card border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold">Alunos Recentes</h2>
          </div>
          <div className="space-y-3">
            {recentStudents.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate(`/alunos/${s.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.objective}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  s.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                }`}>
                  {s.active ? "Ativo" : "Inativo"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
