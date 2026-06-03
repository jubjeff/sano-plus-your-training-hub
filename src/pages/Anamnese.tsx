import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/hooks/use-theme";
import { EDGE_FUNCTION_NAMES, invokeSupabaseEdgeFunction } from "@/integrations/supabase";

const DRAFT_KEY = "sano-anamnese-draft";

type AnamneseForm = {
  fullName: string;
  email: string;
  phone: string;
  age: string;
  weightKg: string;
  goal: "" | "hipertrofia" | "emagrecimento" | "condicionamento" | "recomposicao";
  experienceLevel: "" | "iniciante" | "intermediario" | "avancado";
  availableDaysPerWeek: string;
  sessionDuration: "" | "30min" | "45min" | "60min" | "90min";
  preferredTime: "" | "manha" | "tarde" | "noite";
  availableEquipment: string[];
  injuryHistory: string;
  hasTrainedBefore: boolean;
  stoppedTrainingDuration: string;
};

const INITIAL_FORM: AnamneseForm = {
  fullName: "",
  email: "",
  phone: "",
  age: "",
  weightKg: "",
  goal: "",
  experienceLevel: "",
  availableDaysPerWeek: "",
  sessionDuration: "",
  preferredTime: "",
  availableEquipment: [],
  injuryHistory: "",
  hasTrainedBefore: false,
  stoppedTrainingDuration: "",
};

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function validateStep(step: number, form: AnamneseForm): Record<string, string> {
  const errors: Record<string, string> = {};

  if (step === 1) {
    if (!form.fullName.trim() || form.fullName.trim().length < 3) {
      errors.fullName = "Nome completo obrigatório (mínimo 3 caracteres).";
    }
    if (!form.email.includes("@") || !form.email.includes(".")) {
      errors.email = "Informe um e-mail válido.";
    }
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      errors.phone = "Informe DDD + número (WhatsApp).";
    }
    const age = Number(form.age);
    if (!form.age || isNaN(age) || age < 10 || age > 100) {
      errors.age = "Idade deve ser entre 10 e 100 anos.";
    }
    const weight = Number(form.weightKg);
    if (!form.weightKg || isNaN(weight) || weight <= 0 || weight >= 500) {
      errors.weightKg = "Informe seu peso em kg (ex: 75.5).";
    }
  }

  if (step === 2) {
    if (!form.goal) errors.goal = "Selecione seu objetivo principal.";
    if (!form.experienceLevel) errors.experienceLevel = "Selecione seu nível de experiência.";
    const days = Number(form.availableDaysPerWeek);
    if (!form.availableDaysPerWeek || isNaN(days) || days < 1 || days > 7) {
      errors.availableDaysPerWeek = "Informe entre 1 e 7 dias.";
    }
    if (!form.sessionDuration) errors.sessionDuration = "Selecione a duração do treino.";
    if (!form.preferredTime) errors.preferredTime = "Selecione o horário preferido.";
  }

  if (step === 3) {
    if (form.availableEquipment.length === 0) {
      errors.availableEquipment = "Selecione ao menos uma opção de equipamento.";
    }
    if (!form.injuryHistory.trim()) {
      errors.injuryHistory = "Informe lesões ou limitações (ou escreva \"nenhuma\").";
    }
  }

  return errors;
}

const GOAL_OPTIONS = [
  { value: "hipertrofia", label: "Hipertrofia", desc: "Ganho de massa muscular" },
  { value: "emagrecimento", label: "Emagrecimento", desc: "Redução de gordura corporal" },
  { value: "condicionamento", label: "Condicionamento", desc: "Resistência e disposição" },
  { value: "recomposicao", label: "Recomposição corporal", desc: "Perder gordura e ganhar músculo" },
] as const;

const EXPERIENCE_OPTIONS = [
  { value: "iniciante", label: "Iniciante", desc: "Menos de 6 meses de treino" },
  { value: "intermediario", label: "Intermediário", desc: "6 meses a 2 anos" },
  { value: "avancado", label: "Avançado", desc: "Mais de 2 anos treinando" },
] as const;

const DURATION_OPTIONS = ["30min", "45min", "60min", "90min"] as const;

const TIME_OPTIONS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
] as const;

const EQUIPMENT_OPTIONS = [
  { value: "academia_completa", label: "Academia completa" },
  { value: "halteres_casa", label: "Halteres em casa" },
  { value: "elasticos", label: "Elásticos / Bandas" },
  { value: "sem_equipamento", label: "Sem equipamento (peso corporal)" },
] as const;

const STEPS = ["Seus dados", "Objetivo e rotina", "Contexto físico"];

function OptionCard({
  selected,
  onClick,
  label,
  desc,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl border p-3 text-left transition-colors sm:p-4 ${
        selected
          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <p className={`text-sm font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{label}</p>
      {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
    </button>
  );
}

function CheckCard({
  checked,
  onClick,
  label,
  disabled,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors sm:p-4 ${
        checked
          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/40"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
          checked ? "border-primary bg-primary" : "border-border"
        }`}
      >
        {checked && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export default function Anamnese() {
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AnamneseForm>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...INITIAL_FORM, ...JSON.parse(saved) } : INITIAL_FORM;
    } catch {
      return INITIAL_FORM;
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!submitted) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch {
        // noop
      }
    }
  }, [form, submitted]);

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNext() {
    const stepErrors = validateStep(step, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
    scrollTop();
  }

  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
    scrollTop();
  }

  function toggleEquipment(value: string) {
    setForm((prev) => ({
      ...prev,
      availableEquipment: prev.availableEquipment.includes(value)
        ? prev.availableEquipment.filter((e) => e !== value)
        : [...prev.availableEquipment, value],
    }));
    setErrors((prev) => { const next = { ...prev }; delete next.availableEquipment; return next; });
  }

  async function handleSubmit() {
    const stepErrors = validateStep(3, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await invokeSupabaseEdgeFunction(EDGE_FUNCTION_NAMES.anamnesisSubmit, {
        body: {
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.replace(/\D/g, ""),
          age: Number(form.age),
          weightKg: Number(form.weightKg),
          goal: form.goal,
          experienceLevel: form.experienceLevel,
          availableDaysPerWeek: Number(form.availableDaysPerWeek),
          sessionDuration: form.sessionDuration,
          preferredTime: form.preferredTime,
          availableEquipment: form.availableEquipment,
          injuryHistory: form.injuryHistory.trim() || "nenhuma",
          hasTrainedBefore: form.hasTrainedBefore,
          stoppedTrainingDuration: form.hasTrainedBefore ? form.stoppedTrainingDuration.trim() || null : null,
        },
      });

      localStorage.removeItem(DRAFT_KEY);
      setSubmitted(true);
      scrollTop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.";
      setSubmitError(
        msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")
          ? "Erro de conexão. Verifique sua internet e tente novamente."
          : msg,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const progress = Math.round((step / STEPS.length) * 100);

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-x-hidden px-3 py-8 sm:px-4 sm:py-10 lg:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.1),transparent_28%)]" />

      <button
        onClick={toggleTheme}
        aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-[20px] border border-border/60 bg-card/80 text-muted-foreground transition-colors hover:text-foreground sm:right-6 sm:top-6"
      >
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      <div ref={topRef} className="relative z-10 w-full max-w-[42rem] animate-fade-in py-4">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Sano+ workspace
          </span>
          <Link to="/" className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sano<span className="text-primary">+</span>
          </Link>
          <h1 className="mt-3 text-balance font-display text-2xl font-semibold text-foreground sm:text-3xl">
            {submitted ? "Anamnese enviada!" : "Ficha de anamnese"}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {submitted
              ? "Recebemos seus dados. Em até 24h você receberá seu treino personalizado por e-mail."
              : "Preencha as informações abaixo para que possamos montar seu treino ideal."}
          </p>
        </div>

        {/* Success screen */}
        {submitted ? (
          <div className="section-shell flex flex-col items-center gap-5 p-6 text-center sm:p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Anamnese recebida com sucesso!</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Enviamos uma confirmação para <strong>{form.email}</strong>. Nossa equipe vai analisar seu perfil e
                em até <strong>24 horas</strong> você receberá seu treino personalizado.
              </p>
            </div>
            <div className="mt-2 w-full rounded-2xl border border-border bg-card/60 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximos passos</p>
              <ol className="mt-3 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>Analisamos seu perfil e objetivos.</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>Montamos seu treino personalizado.</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>Você recebe tudo por e-mail para começar.</li>
              </ol>
            </div>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="mb-5 space-y-2">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Etapa {step} de {STEPS.length} — {STEPS[step - 1]}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="section-shell p-4 sm:p-5 lg:p-6">
              {/* Step 1 — Dados pessoais */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input
                      id="fullName"
                      autoComplete="name"
                      placeholder="Seu nome completo"
                      value={form.fullName}
                      onChange={(e) => { setForm((p) => ({ ...p, fullName: e.target.value })); setErrors((p) => { const n = { ...p }; delete n.fullName; return n; }); }}
                      className={errors.fullName ? "border-destructive" : ""}
                    />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={form.email}
                      onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="(11) 99999-9999"
                      value={form.phone}
                      onChange={(e) => { setForm((p) => ({ ...p, phone: formatPhone(e.target.value) })); setErrors((p) => { const n = { ...p }; delete n.phone; return n; }); }}
                      className={errors.phone ? "border-destructive" : ""}
                    />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="age">Idade</Label>
                      <Input
                        id="age"
                        type="number"
                        inputMode="numeric"
                        placeholder="25"
                        min={10}
                        max={100}
                        value={form.age}
                        onChange={(e) => { setForm((p) => ({ ...p, age: e.target.value })); setErrors((p) => { const n = { ...p }; delete n.age; return n; }); }}
                        className={errors.age ? "border-destructive" : ""}
                      />
                      {errors.age && <p className="text-xs text-destructive">{errors.age}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weightKg">Peso atual (kg)</Label>
                      <Input
                        id="weightKg"
                        type="number"
                        inputMode="decimal"
                        placeholder="75.5"
                        step="0.1"
                        min={20}
                        max={499}
                        value={form.weightKg}
                        onChange={(e) => { setForm((p) => ({ ...p, weightKg: e.target.value })); setErrors((p) => { const n = { ...p }; delete n.weightKg; return n; }); }}
                        className={errors.weightKg ? "border-destructive" : ""}
                      />
                      {errors.weightKg && <p className="text-xs text-destructive">{errors.weightKg}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 — Objetivo e rotina */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Objetivo principal</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {GOAL_OPTIONS.map((opt) => (
                        <OptionCard
                          key={opt.value}
                          selected={form.goal === opt.value}
                          onClick={() => { setForm((p) => ({ ...p, goal: opt.value })); setErrors((p) => { const n = { ...p }; delete n.goal; return n; }); }}
                          label={opt.label}
                          desc={opt.desc}
                        />
                      ))}
                    </div>
                    {errors.goal && <p className="text-xs text-destructive">{errors.goal}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Nível de experiência</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {EXPERIENCE_OPTIONS.map((opt) => (
                        <OptionCard
                          key={opt.value}
                          selected={form.experienceLevel === opt.value}
                          onClick={() => { setForm((p) => ({ ...p, experienceLevel: opt.value })); setErrors((p) => { const n = { ...p }; delete n.experienceLevel; return n; }); }}
                          label={opt.label}
                          desc={opt.desc}
                        />
                      ))}
                    </div>
                    {errors.experienceLevel && <p className="text-xs text-destructive">{errors.experienceLevel}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="days">Dias disponíveis por semana</Label>
                      <Input
                        id="days"
                        type="number"
                        inputMode="numeric"
                        placeholder="3"
                        min={1}
                        max={7}
                        value={form.availableDaysPerWeek}
                        onChange={(e) => { setForm((p) => ({ ...p, availableDaysPerWeek: e.target.value })); setErrors((p) => { const n = { ...p }; delete n.availableDaysPerWeek; return n; }); }}
                        className={errors.availableDaysPerWeek ? "border-destructive" : ""}
                      />
                      {errors.availableDaysPerWeek && <p className="text-xs text-destructive">{errors.availableDaysPerWeek}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Duração do treino</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {DURATION_OPTIONS.map((d) => (
                          <OptionCard
                            key={d}
                            selected={form.sessionDuration === d}
                            onClick={() => { setForm((p) => ({ ...p, sessionDuration: d })); setErrors((p) => { const n = { ...p }; delete n.sessionDuration; return n; }); }}
                            label={d}
                          />
                        ))}
                      </div>
                      {errors.sessionDuration && <p className="text-xs text-destructive">{errors.sessionDuration}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário preferido para treinar</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {TIME_OPTIONS.map((opt) => (
                        <OptionCard
                          key={opt.value}
                          selected={form.preferredTime === opt.value}
                          onClick={() => { setForm((p) => ({ ...p, preferredTime: opt.value })); setErrors((p) => { const n = { ...p }; delete n.preferredTime; return n; }); }}
                          label={opt.label}
                        />
                      ))}
                    </div>
                    {errors.preferredTime && <p className="text-xs text-destructive">{errors.preferredTime}</p>}
                  </div>
                </div>
              )}

              {/* Step 3 — Contexto físico */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Equipamentos disponíveis</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {EQUIPMENT_OPTIONS.map((opt) => (
                        <CheckCard
                          key={opt.value}
                          checked={form.availableEquipment.includes(opt.value)}
                          onClick={() => toggleEquipment(opt.value)}
                          label={opt.label}
                        />
                      ))}
                    </div>
                    {errors.availableEquipment && <p className="text-xs text-destructive">{errors.availableEquipment}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Já treinou musculação antes?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <OptionCard
                        selected={form.hasTrainedBefore}
                        onClick={() => setForm((p) => ({ ...p, hasTrainedBefore: true }))}
                        label="Sim"
                      />
                      <OptionCard
                        selected={!form.hasTrainedBefore}
                        onClick={() => setForm((p) => ({ ...p, hasTrainedBefore: false, stoppedTrainingDuration: "" }))}
                        label="Não"
                      />
                    </div>
                  </div>

                  {form.hasTrainedBefore && (
                    <div className="space-y-2">
                      <Label htmlFor="stoppedDuration">Há quanto tempo parou? (opcional)</Label>
                      <Input
                        id="stoppedDuration"
                        placeholder="Ex: 6 meses, 1 ano, 3 semanas..."
                        value={form.stoppedTrainingDuration}
                        onChange={(e) => setForm((p) => ({ ...p, stoppedTrainingDuration: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="injuries">Lesões ou limitações físicas</Label>
                    <Textarea
                      id="injuries"
                      placeholder={'Descreva lesões, cirurgias ou limitações. Se não tiver nenhuma, escreva "nenhuma".'}
                      rows={3}
                      value={form.injuryHistory}
                      onChange={(e) => { setForm((p) => ({ ...p, injuryHistory: e.target.value })); setErrors((p) => { const n = { ...p }; delete n.injuryHistory; return n; }); }}
                      className={errors.injuryHistory ? "border-destructive" : ""}
                    />
                    {errors.injuryHistory && <p className="text-xs text-destructive">{errors.injuryHistory}</p>}
                  </div>

                  {submitError && (
                    <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {submitError}
                    </p>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className={`mt-6 flex ${step > 1 ? "justify-between" : "justify-end"}`}>
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                  </Button>
                )}
                {step < STEPS.length ? (
                  <Button type="button" onClick={handleNext}>
                    Próximo <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Enviando..." : "Enviar anamnese"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Já tem acesso?{" "}
          <Link to="/" className="font-medium text-primary hover:text-primary/80">
            Entrar na plataforma
          </Link>
        </p>
      </div>
    </div>
  );
}
