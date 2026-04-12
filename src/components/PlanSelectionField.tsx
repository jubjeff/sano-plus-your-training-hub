import { CheckCircle2, Crown, Users, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { TeacherPlanType } from "@/types/auth";

type PlanSelectionFieldProps = {
  value: TeacherPlanType | null;
  onChange: (plan: TeacherPlanType) => void;
  mockProPaymentConfirmed: boolean;
  onMockProPaymentConfirmedChange: (checked: boolean) => void;
  error?: string;
  mockPaymentError?: string;
  disabled?: boolean;
};

const plans = [
  {
    id: "basic" as const,
    title: "Plano Basic",
    eyebrow: "Comece validando sua operacao",
    icon: UserRound,
    accent: "text-primary",
    bullets: [
      "Permite apenas 1 aluno na biblioteca.",
      "Pode liberar 1 mes de trial gratuito, sujeito a elegibilidade do CPF.",
      "Se o CPF ja usou trial antes, o acesso fica pendente de pagamento/upgrade.",
    ],
    badge: "1 aluno",
    helper: "Ideal para testar o fluxo e validar seu onboarding.",
  },
  {
    id: "pro" as const,
    title: "Plano Pro",
    eyebrow: "Escala total desde o inicio",
    icon: Crown,
    accent: "text-warning",
    bullets: [
      "Permite alunos ilimitados.",
      "Ativacao imediata com pagamento mockado nesta fase.",
      "Estrutura pronta para trocar o mock por gateway real futuramente.",
    ],
    badge: "Ilimitado",
    helper: "Nesta etapa, a assinatura e confirmada de forma simulada pelo proprio sistema.",
  },
];

export default function PlanSelectionField({
  value,
  onChange,
  mockProPaymentConfirmed,
  onMockProPaymentConfirmedChange,
  error,
  mockPaymentError,
  disabled,
}: PlanSelectionFieldProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Escolha sua modalidade</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Selecione o plano antes de concluir o cadastro. O Basic valida trial por CPF; o Pro usa uma confirmacao mockada nesta fase.
        </p>
      </div>

      <div className="grid gap-4">
        {plans.map((plan) => {
          const selected = value === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onChange(plan.id)}
              disabled={disabled}
              className={cn(
                "rounded-[28px] border bg-card/70 p-5 text-left transition-all",
                selected
                  ? "border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(52,211,153,0.18)]"
                  : "border-border/60 hover:border-primary/30 hover:bg-card",
                disabled ? "cursor-not-allowed opacity-70" : "",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-background/80", plan.accent)}>
                      <plan.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{plan.eyebrow}</p>
                      <h3 className="text-lg font-semibold text-foreground">{plan.title}</h3>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-semibold text-foreground">
                      {plan.badge}
                    </span>
                    {selected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {plan.id === "basic" ? "Plano Basic selecionado." : "Plano Pro selecionado."}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]", selected ? "border-primary/30 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground")}>
                  {selected ? "Selecionado" : "Escolher"}
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {plan.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 rounded-2xl border border-border/50 bg-background/60 px-3 py-3 text-xs leading-5 text-muted-foreground">
                {plan.helper}
              </p>
            </button>
          );
        })}
      </div>

      {value === "pro" ? (
        <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="mockProPaymentConfirmed"
              checked={mockProPaymentConfirmed}
              onCheckedChange={(checked) => onMockProPaymentConfirmedChange(Boolean(checked))}
              disabled={disabled}
              className="mt-1"
            />
            <div>
              <label htmlFor="mockProPaymentConfirmed" className="text-sm font-medium text-foreground">
                Confirmo a assinatura mockada do plano Pro.
              </label>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                O pagamento esta sendo simulado neste momento. Ao continuar, o sistema registrara uma aprovacao fake e ativara o plano Pro como `active`.
              </p>
            </div>
          </div>
          {mockPaymentError ? <p className="mt-3 text-xs font-medium text-destructive">{mockPaymentError}</p> : null}
        </div>
      ) : null}

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
