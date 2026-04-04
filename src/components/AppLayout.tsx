import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Dumbbell, DollarSign, Menu, Moon, Sparkles, Sun, LogOut } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/biblioteca", label: "Biblioteca", icon: Dumbbell },
];

const futureItems = [{ label: "Financeiro", icon: DollarSign }];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const title = location.pathname === "/dashboard"
    ? "Operação diária"
    : location.pathname.startsWith("/alunos")
    ? "Gestão de alunos"
    : location.pathname.startsWith("/biblioteca")
    ? "Biblioteca de treinos"
    : "Painel Sano+";

  return (
    <div className="flex min-h-screen w-full">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-sidebar-border px-6 py-6">
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-bold tracking-tight text-sidebar-accent-foreground">
              Sano<span className="text-sidebar-primary">+</span>
            </span>
            <span className="rounded-full border border-sidebar-border bg-sidebar-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-primary">
              Pro
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-sidebar-foreground/85">
            Plataforma para personal trainers organizarem alunos, treino e evolução em um só fluxo.
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-5">
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

          <div className="px-3 pb-2 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-muted">Em breve</span>
          </div>
          {futureItems.map((item) => (
            <div key={item.label} className="flex cursor-not-allowed items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium text-sidebar-muted opacity-50">
              <item.icon className="h-5 w-5" />
              {item.label}
            </div>
          ))}

          <div className="mx-3 mt-5 rounded-[24px] border border-sidebar-border bg-sidebar-accent/80 p-4">
            <div className="flex items-center gap-2 text-sidebar-accent-foreground">
              <Sparkles className="h-4 w-4 text-sidebar-primary" />
              <span className="text-sm font-semibold">Visão operacional</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-sidebar-foreground">
              Priorize trocas de treino, acompanhe carteira ativa e mantenha a biblioteca pronta para reutilização.
            </p>
          </div>
        </nav>

        <div className="space-y-1 border-t border-sidebar-border p-4">
          <NavLink
            to="/"
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </NavLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-border/60 bg-background/75 px-4 backdrop-blur lg:px-8">
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

          <div className="flex items-center gap-3 rounded-[24px] border border-border/60 bg-card/70 px-3 py-2 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-sm font-bold text-primary">
              PT
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium">Professor</p>
              <p className="text-xs text-muted-foreground">Personal trainer</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
