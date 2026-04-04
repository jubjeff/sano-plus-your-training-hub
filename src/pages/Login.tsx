import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/use-theme";

export default function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <button
        onClick={toggleTheme}
        aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
        className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-[20px] border border-border/60 bg-card/70 text-muted-foreground transition-colors hover:text-foreground sm:right-6 sm:top-6"
      >
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Sano+ workspace
          </span>
          <span className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground">
            Sano<span className="text-primary">+</span>
          </span>
          <p className="mt-2 text-sm text-muted-foreground">Gerencie seus alunos e treinos com uma experiência premium</p>
        </div>

        <div className="section-shell p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" defaultValue="professor@sanoplus.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  defaultValue="123456"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            MVP de demonstração. Clique em Entrar para acessar.
          </p>
        </div>
      </div>
    </div>
  );
}
