import { Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

type AuthShellProps = {
  badge?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthShell({ badge = "Sano+ workspace", title, subtitle, children, footer }: AuthShellProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden px-3 py-8 sm:px-4 sm:py-10 lg:px-6 lg:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.1),transparent_28%)]" />

      <button
        onClick={toggleTheme}
        aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-[20px] border border-border/60 bg-card/80 text-muted-foreground transition-colors hover:text-foreground sm:right-6 sm:top-6"
      >
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      <div className="relative z-10 my-auto w-full max-w-[42rem] animate-fade-in">
        <div className="mb-5 flex flex-col items-center text-center sm:mb-7 lg:mb-8">
          <span className="max-w-full rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            {badge}
          </span>
          <Link to="/" className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sano<span className="text-primary">+</span>
          </Link>
          <h1 className="mt-4 text-balance font-display text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </div>

        <div className="section-shell p-4 sm:p-5 lg:p-6">{children}</div>

        {footer ? <div className="mt-4 px-2 text-center text-sm text-muted-foreground sm:mt-5">{footer}</div> : null}
      </div>
    </div>
  );
}
