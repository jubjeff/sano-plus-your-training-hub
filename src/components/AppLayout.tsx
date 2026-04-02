import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Dumbbell, DollarSign, Menu, X, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/biblioteca", label: "Biblioteca de Treinos", icon: Dumbbell },
];

const futureItems = [
  { label: "Financeiro", icon: DollarSign, disabled: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
          <Dumbbell className="h-7 w-7 text-sidebar-primary" />
          <span className="font-display text-xl font-bold text-sidebar-accent-foreground tracking-tight">
            Sano<span className="text-sidebar-primary">Plus</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}

          <div className="pt-4 pb-2 px-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-muted">Em breve</span>
          </div>
          {futureItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted cursor-not-allowed opacity-50"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            {theme === "light" ? "Modo escuro" : "Modo claro"}
          </button>
          <NavLink
            to="/"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
              P
            </div>
            <span className="hidden text-sm font-medium sm:block">Professor</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
