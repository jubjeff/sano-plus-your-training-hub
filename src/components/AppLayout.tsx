import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { DollarSign, Dumbbell, LayoutDashboard, LogOut, Menu, Moon, Sparkles, Sun, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

const coachNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/biblioteca", label: "Biblioteca", icon: Dumbbell },
];

const studentNavItems = [{ to: "/aluno/dashboard", label: "Meu painel", icon: Dumbbell }];

const futureItems = [{ label: "Financeiro", icon: DollarSign }];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout, touchSessionActivity } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = user?.role === "student" ? studentNavItems : coachNavItems;
  const isCoach = user?.role === "coach";
  const isBasicPlan = user?.teacherPlanType === "basic";
  const isProPlan = user?.teacherPlanType === "pro";
  const planBadge = isCoach ? (isProPlan ? "Pro" : isBasicPlan ? "Basic" : "Conta") : "Aluno";

  const title = location.pathname === "/dashboard"
    ? "Operação diária"
    : location.pathname === "/aluno/dashboard" || location.pathname === "/area-do-aluno"
    ? "Dashboard do aluno"
    : location.pathname === "/perfil"
    ? "Meu perfil"
    : location.pathname.startsWith("/alunos")
    ? "Gestão de alunos"
    : location.pathname.startsWith("/biblioteca")
    ? "Biblioteca de treinos"
    : "Painel Sano+";

  useEffect(() => {
    void touchSessionActivity();
  }, [location.pathname, touchSessionActivity]);

  const initials = useMemo(() => {
    const parts = user?.fullName.trim().split(/\s+/).filter(Boolean) ?? [];
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SP";
  }, [user?.fullName]);

  const handlePlanCtaClick = () => {
    if (location.pathname === "/perfil") {
      const upgradeSection = document.getElementById("profile-upgrade-cta");
      if (upgradeSection) {
        upgradeSection.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    navigate("/perfil?upgrade=pro");
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Sessão encerrada com segurança.");
    window.location.replace("/");
  };

  return (
    <div className="flex h-svh w-full overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-svh w-[min(286px,calc(100vw-1rem))] min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:w-[286px] lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-sidebar-border px-6 py-6">
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-bold tracking-tight text-sidebar-accent-foreground">
              Sano<span className="text-sidebar-primary">+</span>
            </span>
            {isCoach && isBasicPlan ? (
              <button
                type="button"
                onClick={handlePlanCtaClick}
                className="group relative overflow-hidden rounded-full border border-sidebar-border bg-sidebar-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-primary transition-all duration-200 hover:border-sidebar-primary/40 hover:bg-sidebar-primary/15 hover:text-sidebar-accent-foreground"
                aria-label="Fazer upgrade para o plano Pro"
                title="Fazer upgrade para o plano Pro"
              >
                <span className="block transition-all duration-200 group-hover:-translate-y-full group-hover:opacity-0">
                  {planBadge}
                </span>
                <span className="absolute inset-0 flex items-center justify-center translate-y-full opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  Pro
                </span>
              </button>
            ) : (
              <span className="rounded-full border border-sidebar-border bg-sidebar-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-primary">
                {planBadge}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-6 text-sidebar-foreground/85">
            Plataforma para personal trainers organizarem alunos, treinos e evolução em um só fluxo.
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}

          {user?.role !== "student" ? (
            <>
              <div className="px-3 pb-2 pt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-muted">Em breve</span>
              </div>
              {futureItems.map((item) => (
                <div key={item.label} className="flex cursor-not-allowed items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium text-sidebar-muted opacity-50">
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </div>
              ))}
            </>
          ) : null}

          <div className="mx-3 mt-5 rounded-[24px] border border-sidebar-border bg-sidebar-accent/80 p-4">
            <div className="flex items-center gap-2 text-sidebar-accent-foreground">
              <Sparkles className="h-4 w-4 text-sidebar-primary" />
              <span className="text-sm font-semibold">Visão operacional</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-sidebar-foreground">
              Priorize as trocas de treino, acompanhe a carteira ativa e mantenha a biblioteca pronta para reutilização.
            </p>
          </div>
        </nav>

        <div className="mt-auto shrink-0 space-y-1 border-t border-sidebar-border p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center gap-3 border-b border-border/60 bg-background/75 px-3 py-3 backdrop-blur sm:px-4 lg:flex-nowrap lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-2xl border border-border/60 bg-card/70 p-2.5 hover:bg-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">Sano+ workspace</p>
            <h1 className="truncate font-display text-lg font-semibold text-foreground">{title}</h1>
          </div>

          <button
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
            className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-border/60 bg-card/70 text-muted-foreground transition-colors hover:text-foreground"
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={() => navigate("/perfil")}
            className={`min-w-0 max-w-full flex items-center gap-3 rounded-[24px] border border-border/60 bg-card/70 px-3 py-2 text-left shadow-sm transition-colors hover:bg-card ${
              location.pathname === "/perfil" ? "ring-1 ring-primary/30" : ""
            }`}
          >
            <Avatar className="h-10 w-10 rounded-2xl border border-border/60">
              {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.fullName} className="object-cover" /> : null}
              <AvatarFallback className="rounded-2xl bg-primary/15 text-sm font-bold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium">{user?.fullName || "Conta Sano+"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email || "Personal trainer"}</p>
            </div>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
