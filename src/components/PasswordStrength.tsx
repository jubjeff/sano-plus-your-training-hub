import { CheckCircle2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getPasswordStrength, validateStrongPassword } from "@/lib/auth-validators";
import { cn } from "@/lib/utils";

export default function PasswordStrength({ password }: { password: string }) {
  const checks = validateStrongPassword(password);
  const strength = getPasswordStrength(password);

  const items = [
    { valid: checks.minLength, label: "Ao menos 8 caracteres" },
    { valid: checks.uppercase, label: "1 letra maiuscula" },
    { valid: checks.lowercase, label: "1 letra minuscula" },
    { valid: checks.number, label: "1 numero" },
    { valid: checks.special, label: "1 caractere especial" },
  ];

  const progressValue = (strength.score / 5) * 100;
  const toneClass = strength.score <= 2 ? "text-destructive" : strength.score < 5 ? "text-amber-500" : "text-primary";

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Forca da senha</p>
          <p className={cn("text-xs font-medium", toneClass)}>{password ? strength.label : "Comece a digitar"}</p>
        </div>
        <span className="rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {strength.score}/5
        </span>
      </div>
      <Progress value={password ? progressValue : 0} className="h-2 bg-background" />
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.valid ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Circle className="h-3.5 w-3.5" />}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
