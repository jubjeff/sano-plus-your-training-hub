import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "@/components/AuthShell";
import PlanSelectionField from "@/components/PlanSelectionField";
import PasswordField from "@/components/PasswordField";
import PasswordStrength from "@/components/PasswordStrength";
import ProfileImageField from "@/components/ProfileImageField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { AuthServiceError } from "@/lib/auth-service";
import { formatCpf, mapZodErrors, normalizeEmail, registerSchema } from "@/lib/auth-validators";
import { createProfilePreviewUrl, validateProfileImageFile } from "@/lib/profile-media";
import { sanitizeInternalRedirectPath } from "@/lib/supabase/auth-redirects";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    birthDate: "",
    cpf: "",
    email: "",
    password: "",
    confirmPassword: "",
    selectedPlan: null as "basic" | "pro" | null,
    mockProPaymentConfirmed: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const maxBirthDate = useMemo(() => {
    const currentDate = new Date();
    currentDate.setFullYear(currentDate.getFullYear() - 18);
    return currentDate.toISOString().slice(0, 10);
  }, []);

  const handleAvatarChange = (file: File | null) => {
    if (!file) {
      if (avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      setErrors((current) => {
        const next = { ...current };
        delete next.avatarFile;
        return next;
      });
      return;
    }

    const error = validateProfileImageFile(file);
    if (error) {
      setErrors((current) => ({ ...current, avatarFile: error }));
      return;
    }

    if (avatarPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarFile(file);
    setAvatarPreviewUrl(createProfilePreviewUrl(file));
    setErrors((current) => {
      const next = { ...current };
      delete next.avatarFile;
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(mapZodErrors(parsed.error));
      return;
    }

    if (!form.selectedPlan) {
      setErrors((current) => ({ ...current, selectedPlan: "Escolha um plano para continuar." }));
      return;
    }

    if (form.selectedPlan === "pro" && !form.mockProPaymentConfirmed) {
      setErrors((current) => ({ ...current, mockProPaymentConfirmed: "Confirme a assinatura simulada do plano Pro para continuar." }));
      return;
    }

    if (avatarFile) {
      const avatarError = validateProfileImageFile(avatarFile);
      if (avatarError) {
        setErrors((current) => ({ ...current, avatarFile: avatarError }));
        return;
      }
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const currentUser = await register({
        fullName: parsed.data.fullName,
        birthDate: parsed.data.birthDate,
        cpf: parsed.data.cpf,
        email: parsed.data.email,
        password: parsed.data.password,
        avatarFile,
        selectedPlan: form.selectedPlan,
        mockProPaymentConfirmed: form.mockProPaymentConfirmed,
      });

      if (!currentUser) {
        toast.success("Conta criada. Confirme seu e-mail para concluir o acesso e ativar seu plano.");
        navigate("/", { replace: true });
        return;
      }

      if (form.selectedPlan === "pro") {
        toast.success("Assinatura Pro confirmada com sucesso.");
      } else if (currentUser?.teacherSubscriptionStatus === "trialing") {
        toast.success("Seu periodo de teste foi ativado por 1 mes.");
      } else if (currentUser?.teacherSubscriptionStatus === "pending_payment") {
        toast.warning("Este CPF ja utilizou o periodo de teste gratuito. Para liberar o acesso, assine o plano Pro.");
      } else {
        toast.success("Conta criada com sucesso.");
      }
      const params = new URLSearchParams(location.search);
      navigate(
        sanitizeInternalRedirectPath(
          params.get("redirect"),
          currentUser?.teacherHasActiveAccess === false ? "/perfil" : "/dashboard",
        ),
        { replace: true },
      );
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setErrors(error.field ? { [error.field]: error.message } : { form: error.message });
      } else {
        setErrors({ form: "Nao foi possivel criar sua conta agora. Tente novamente." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Crie sua conta"
      subtitle="Configure um acesso profissional com validacoes fortes, avatar e sessao persistente."
      footer={
        <span>
          Ja tem conta?{" "}
          <Link to="/" className="font-medium text-primary transition-colors hover:text-primary/80">
            Entrar
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ProfileImageField
          previewUrl={avatarPreviewUrl}
          onFileChange={handleAvatarChange}
          onRemove={() => handleAvatarChange(null)}
          error={errors.avatarFile}
          disabled={isSubmitting}
          fullName={form.fullName}
        />

        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input
            id="fullName"
            autoComplete="name"
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            placeholder="Seu nome completo"
            className={errors.fullName ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.fullName ? <p className="text-xs font-medium text-destructive">{errors.fullName}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input
              id="birthDate"
              type="date"
              autoComplete="bday"
              max={maxBirthDate}
              value={form.birthDate}
              onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
              className={errors.birthDate ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.birthDate ? <p className="text-xs font-medium text-destructive">{errors.birthDate}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              autoComplete="off"
              value={form.cpf}
              onChange={(event) => setForm((current) => ({ ...current, cpf: formatCpf(event.target.value) }))}
              placeholder="000.000.000-00"
              className={errors.cpf ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.cpf ? <p className="text-xs font-medium text-destructive">{errors.cpf}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            onBlur={() => setForm((current) => ({ ...current, email: normalizeEmail(current.email) }))}
            placeholder="seu@email.com"
            className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.email ? <p className="text-xs font-medium text-destructive">{errors.email}</p> : null}
        </div>

        <PlanSelectionField
          value={form.selectedPlan}
          onChange={(selectedPlan) => {
            setForm((current) => ({
              ...current,
              selectedPlan,
              mockProPaymentConfirmed: selectedPlan === "pro" ? current.mockProPaymentConfirmed : false,
            }));
            setErrors((current) => {
              const next = { ...current };
              delete next.selectedPlan;
              if (selectedPlan !== "pro") {
                delete next.mockProPaymentConfirmed;
              }
              return next;
            });
          }}
          mockProPaymentConfirmed={form.mockProPaymentConfirmed}
          onMockProPaymentConfirmedChange={(mockProPaymentConfirmed) => {
            setForm((current) => ({ ...current, mockProPaymentConfirmed }));
            setErrors((current) => {
              const next = { ...current };
              delete next.mockProPaymentConfirmed;
              return next;
            });
          }}
          error={errors.selectedPlan}
          mockPaymentError={errors.mockProPaymentConfirmed}
          disabled={isSubmitting}
        />

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <PasswordField
            id="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Crie uma senha forte"
            error={errors.password}
          />
          {errors.password ? <p className="text-xs font-medium text-destructive">{errors.password}</p> : null}
        </div>

        <PasswordStrength password={form.password} />

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <PasswordField
            id="confirmPassword"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Repita a senha"
            error={errors.confirmPassword}
          />
          {errors.confirmPassword ? <p className="text-xs font-medium text-destructive">{errors.confirmPassword}</p> : null}
        </div>

        {errors.form ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting || !form.selectedPlan}>
          {isSubmitting ? "Criando conta..." : form.selectedPlan ? "Concluir cadastro" : "Escolha um plano para continuar"}
        </Button>
      </form>
    </AuthShell>
  );
}
