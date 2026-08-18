import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardList, DollarSign, Dumbbell, LayoutDashboard, LogOut, Menu, Moon, Sparkles, Sun, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/auth/use-auth";
import { useTheme } from "@/hooks/use-theme";

type NavItem = { to: string; label: string; icon: React.ElementType };
type NavGroup = { label: string; icon: React.ElementType; base: string; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const coachNavItems: NavEntry[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Alunos",
    icon: Users,
    base: "/alunos",
    children: [
      { to: "/alunos", label: "Lista de alunos", icon: Users },
      { to: "/anamneses", label: "Anamneses", icon: ClipboardList },
      { to: "/assinaturas", label: "Assinaturas", icon: DollarSign },
    ],
  },
  { to: "/biblioteca", label: "Biblioteca", icon: Dumbbell },
];

const studentNavItems: NavEntry[] = [{ to: "/aluno/dashboard", label: "Meu painel", icon: Dumbbell }];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout, touchSessionActivity } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Grupos expansíveis: inicia aberto se a rota atual pertence ao grupo
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const entry of coachNavItems) {
      if (isNavGroup(entry)) {
        const active =
          location.pathname.startsWith(entry.base) ||
          entry.children.some((c) => location.pathname.startsWith(c.to));
        initial[entry.label] = active;
      }
    }
    return initial;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

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
    : location.pathname.startsWith("/anamneses")
    ? "Fila de anamneses"
    : location.pathname.startsWith("/assinaturas")
    ? "Assinaturas"
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
          className={`fixed inset-y-0 left-0 z-40 flex h-svh w-[min(286px,calc(100vw-1rem))] min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:w-[292px] lg:translate-x-0 xl:w-[304px] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-sidebar-border px-5 py-5 sm:px-6 sm:py-6">
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

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5">
          {(navItems as NavEntry[]).map((entry) => {
            if (isNavGroup(entry)) {
              const isOpen = !!openGroups[entry.label];
              const groupActive = location.pathname.startsWith(entry.base) ||
                entry.children.some((c) => location.pathname.startsWith(c.to));
              return (
                <div key={entry.label}>
                  {/* Botão do grupo — clicável para abrir/fechar */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(entry.label)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors ${
                      groupActive && !isOpen
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <entry.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">{entry.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Sub-itens — visíveis só quando aberto */}
                  {isOpen && (
                    <div className="ml-3.5 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                      {entry.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end={child.to === "/alunos"}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }`
                          }
                        >
                          <child.icon className="h-4 w-4 shrink-0" />
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavLink
                key={entry.to}
                to={entry.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`
                }
              >
                <entry.icon className="h-5 w-5" />
                {entry.label}
              </NavLink>
            );
          })}

          <div className="mx-3 mt-4 rounded-[24px] border border-sidebar-border bg-sidebar-accent/80 p-4 sm:mt-5">
            <div className="flex items-center gap-2 text-sidebar-accent-foreground">
              <Sparkles className="h-4 w-4 text-sidebar-primary" />
              <span className="text-sm font-semibold">Visão operacional</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-sidebar-foreground">
              Priorize as trocas de treino, acompanhe a carteira ativa e mantenha a biblioteca pronta para reutilização.
            </p>
          </div>
        </nav>

        <div className="mt-auto shrink-0 space-y-1.5 border-t border-sidebar-border p-3 sm:p-4">
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
        <header className="sticky top-0 z-20 flex min-h-[4.75rem] flex-wrap items-center gap-2.5 border-b border-border/60 bg-background/75 px-3 py-3 backdrop-blur sm:min-h-20 sm:px-4 lg:flex-nowrap lg:gap-4 lg:px-6 xl:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-2xl border border-border/60 bg-card/70 p-2.5 hover:bg-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">Sano+ workspace</p>
            <h1 className="truncate font-display text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
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
            className={`min-w-0 max-w-full flex items-center gap-2.5 rounded-[24px] border border-border/60 bg-card/70 px-3 py-2 text-left shadow-sm transition-colors hover:bg-card sm:gap-3 sm:px-3.5 ${
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

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 xl:p-8 2xl:px-10 2xl:py-8">{children}</main>
      </div>
    </div>
  );
}
