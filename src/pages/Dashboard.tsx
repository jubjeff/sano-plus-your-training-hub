import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/auth/use-auth";
import { useStore } from "@/hooks/use-store";
import { formatDate, getInitials, getRelativeWorkoutLabel } from "@/lib/format";
import { buildCoachRanking, getEngagementLabel, getEngagementTone } from "@/lib/training-management";
import { getFinancialStatusLabel, getStudentFinancialStatus } from "@/lib/student-dashboard";
import { AlertTriangle, ArrowRight, BellRing, Clock, Dumbbell, RefreshCw, UserCheck, UserX, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const { students, workouts, checkIns, alerts, markCoachAlertRead } = useStore();
  const navigate = useNavigate();
  const [rankingFilter, setRankingFilter] = useState<"top" | "risk" | "blocked" | "goal">("top");

  const totalStudents = students.length;
  const activeStudents = students.filter((student) => student.studentStatus === "active").length;
  const inactiveStudents = students.filter((student) => student.studentStatus !== "active").length;

  const needsWorkoutChange = students
    .filter((student) => student.studentStatus === "active" && student.nextWorkoutChange)
    .sort((a, b) => (a.nextWorkoutChange || "").localeCompare(b.nextWorkoutChange || ""))
    .slice(0, 5);

  const recentStudents = [...students]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 5);

  const ranking = useMemo(() => buildCoachRanking(students, checkIns), [checkIns, students]);
  const filteredRanking = useMemo(() => {
    switch (rankingFilter) {
      case "risk":
        return ranking.filter((entry) => entry.stats.engagementStatus !== "active");
      case "blocked":
        return ranking.filter((entry) => entry.financialBlocked);
      case "goal":
        return ranking.filter((entry) => entry.stats.weeklyGoalAchieved);
      default:
        return ranking;
    }
  }, [ranking, rankingFilter]);

  const proDaysRemaining = useMemo(() => {
    if (user?.role !== "coach" || user.teacherPlanType !== "pro" || !user.teacherCurrentPeriodEndsAt) {
      return null;
    }

    return Math.ceil((new Date(user.teacherCurrentPeriodEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, [user]);

  const shouldShowProEndingAlert = typeof proDaysRemaining === "number" && proDaysRemaining > 0 && proDaysRemaining <= 30;

  const stats = [
    { label: "Total de alunos", value: totalStudents, icon: Users, tone: "text-primary" },
    { label: "Alunos ativos", value: activeStudents, icon: UserCheck, tone: "text-success" },
    { label: "Alunos inativos", value: inactiveStudents, icon: UserX, tone: "text-destructive" },
    { label: "Treinos prontos", value: workouts.length, icon: Dumbbell, tone: "text-accent" },
  ];

  return (
    <div className="page-shell">
      {shouldShowProEndingAlert && user?.teacherCurrentPeriodEndsAt ? (
        <Alert className="border-warning/30 bg-warning/10 text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>Seu PRO entra no ultimo mes de validade</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Seu acesso PRO vai ate {formatDate(user.teacherCurrentPeriodEndsAt)}. Restam {proDaysRemaining} dia{proDaysRemaining === 1 ? "" : "s"} para o encerramento do ciclo atual.
            </span>
            <button
              type="button"
              onClick={() => navigate("/perfil")}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Ver plano no perfil
              <ArrowRight className="h-4 w-4" />
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="section-shell overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-8">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Dashboard
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">Visao geral da sua operacao</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Priorize alunos que precisam de atencao, acompanhe a cadencia de troca de treinos e mantenha o fluxo diario do Sano+ sob controle.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Foco de hoje</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{needsWorkoutChange.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">alunos com revisao proxima de treino</p>
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
                      {getInitials(student.fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{student.fullName}</p>
                      <p className="text-xs text-muted-foreground">{student.goal}</p>
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
                    {getInitials(student.fullName)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{student.fullName}</p>
                    <p className="text-xs text-muted-foreground">Entrou em {formatDate(student.startDate)}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.studentStatus === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {student.studentStatus === "active" ? "Ativo" : "Inativo"}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="section-shell p-6 lg:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold">Ranking de adesao</h2>
                <p className="text-sm text-muted-foreground">Leia rapidamente quem esta performando bem e quem precisa de atencao.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={`rounded-full px-3 py-1 text-xs font-semibold ${rankingFilter === "top" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} onClick={() => setRankingFilter("top")}>Mais engajados</button>
              <button className={`rounded-full px-3 py-1 text-xs font-semibold ${rankingFilter === "risk" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} onClick={() => setRankingFilter("risk")}>Em risco</button>
              <button className={`rounded-full px-3 py-1 text-xs font-semibold ${rankingFilter === "blocked" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} onClick={() => setRankingFilter("blocked")}>Bloqueados</button>
              <button className={`rounded-full px-3 py-1 text-xs font-semibold ${rankingFilter === "goal" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} onClick={() => setRankingFilter("goal")}>Meta concluida</button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredRanking.slice(0, 6).map(({ student, stats, financialBlocked }) => (
              <button
                key={student.id}
                onClick={() => navigate(`/alunos/${student.id}`)}
                className="flex w-full items-center justify-between gap-4 rounded-[22px] border border-border/60 bg-background/70 px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-muted/60"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold text-primary">
                    {getInitials(student.fullName)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{student.fullName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getEngagementTone(stats.engagementStatus)}`}>{getEngagementLabel(stats.engagementStatus)}</span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">Semana {stats.weeklyCheckIns}/{stats.weeklyGoal}</span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">Streak {stats.currentStreak}</span>
                      {financialBlocked ? <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] text-destructive">Bloqueado</span> : null}
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">{stats.attendanceRate}%</p>
                  <p className="text-xs text-muted-foreground">{stats.daysWithoutCheckIn} dia{stats.daysWithoutCheckIn === 1 ? "" : "s"} sem check-in</p>
                  <p className="mt-1 text-xs text-muted-foreground">{getFinancialStatusLabel(getStudentFinancialStatus(student))}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="section-shell p-6 lg:p-7">
          <div className="mb-5 flex items-center gap-2">
            <BellRing className="h-5 w-5 text-warning" />
            <div>
              <h2 className="font-display text-xl font-semibold">Alertas de acompanhamento</h2>
              <p className="text-sm text-muted-foreground">Alertas automaticos sobre desengajamento, meta e bloqueio financeiro.</p>
            </div>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum alerta ativo no momento.</p>
            ) : (
              alerts.slice(0, 6).map((alert) => {
                const student = students.find((item) => item.id === alert.studentId);
                return (
                  <div key={alert.id} className={`rounded-[22px] border px-4 py-4 ${alert.isRead ? "border-border/60 bg-background/60" : "border-warning/20 bg-warning/10"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{alert.description}</p>
                        {student ? <button onClick={() => navigate(`/alunos/${student.id}`)} className="mt-3 text-xs font-semibold text-primary">Abrir perfil do aluno</button> : null}
                      </div>
                      {!alert.isRead ? (
                        <button onClick={() => markCoachAlertRead(alert.id)} className="text-xs font-semibold text-primary">
                          Marcar como lido
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
