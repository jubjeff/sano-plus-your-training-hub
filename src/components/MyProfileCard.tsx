import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Crown, FileLock2, Mail, Pencil, Phone, Save, ShieldCheck, X } from "lucide-react";
import ProfileImageField from "@/components/ProfileImageField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/auth/use-auth";
import { authService, AuthServiceError } from "@/services/auth.service";
import { formatCpf, formatPhone, mapZodErrors, updateProfileSchema } from "@/lib/auth-validators";
import { formatDate } from "@/lib/format";
import { createProfilePreviewUrl, validateProfileImageFile } from "@/lib/profile-media";

export default function MyProfileCard({ showHeader = true }: { showHeader?: boolean }) {
  const { user, updateProfile, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpgradingPlan, setIsUpgradingPlan] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName ?? "",
    birthDate: user?.birthDate ?? "",
    phone: user?.phone ? formatPhone(user.phone) : "",
    notes: user?.notes ?? "",
  });

  useEffect(() => {
    setForm({
      fullName: user?.fullName ?? "",
      birthDate: user?.birthDate ?? "",
      phone: user?.phone ? formatPhone(user.phone) : "",
      notes: user?.notes ?? "",
    });
    setAvatarPreviewUrl(null);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setErrors({});
  }, [user]);

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

  if (!user) return null;

  const effectiveAvatar = removeAvatar ? null : avatarPreviewUrl || user.avatarUrl || null;
  const cpfDisplay = user.cpf ? formatCpf(user.cpf) : "Não vinculado a esta conta";
  const isCoachAccount = user.role === "coach";
  const isBasicPlan = user.teacherPlanType === "basic";
  const isProPlan = user.teacherPlanType === "pro";
  const currentPlanLabel = isProPlan ? "Pro" : isBasicPlan ? "Basic" : "Conta";
  const shouldShowUpgradeCta = isCoachAccount && isBasicPlan;
  const proValidityDisplay = isCoachAccount && isProPlan && user.teacherCurrentPeriodEndsAt
    ? formatDate(user.teacherCurrentPeriodEndsAt)
    : "Sem validade informada";

  const resetEditingState = () => {
    setForm({
      fullName: user.fullName,
      birthDate: user.birthDate,
      phone: user.phone ? formatPhone(user.phone) : "",
      notes: user.notes ?? "",
    });
    if (avatarPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarPreviewUrl(null);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setErrors({});
    setIsEditing(false);
  };

  const handleAvatarChange = (file: File | null) => {
    if (!file) {
      if (avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
      setAvatarPreviewUrl(null);
      setAvatarFile(null);
      setRemoveAvatar(true);
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
    setRemoveAvatar(false);
    setErrors((current) => {
      const next = { ...current };
      delete next.avatarFile;
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = updateProfileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(mapZodErrors(parsed.error));
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
      await updateProfile({
        fullName: parsed.data.fullName,
        birthDate: parsed.data.birthDate,
        phone: parsed.data.phone ?? null,
        notes: parsed.data.notes ?? null,
        avatarFile,
        removeAvatar,
      });
      toast.success("Perfil atualizado com sucesso.");
      setIsEditing(false);
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      setRemoveAvatar(false);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setErrors(error.field ? { [error.field]: error.message } : { form: error.message });
      } else {
        setErrors({ form: "Não foi possível atualizar seu perfil agora. Tente novamente." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBecomePro = async () => {
    setIsUpgradingPlan(true);

    try {
      await authService.activateCoachProPlan();
      await refreshUser();
      toast.success("Assinatura Pro confirmada com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível ativar o plano Pro agora. Tente novamente.";
      toast.error(message);
    } finally {
      setIsUpgradingPlan(false);
    }
  };

  return (
    <section className="section-shell overflow-hidden">
      <div className="flex flex-col gap-6 p-6 lg:p-8">
        {showHeader ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Meu Perfil</Badge>
                <Badge variant="outline" className="border-primary/20 bg-background/70 text-muted-foreground">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  Dados protegidos
                </Badge>
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold text-foreground">Seus dados na conta Sano+</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Atualize apenas as informações permitidas do seu perfil. Campos sensíveis seguem protegidos e fora de qualquer fluxo de edição.
                </p>
              </div>
            </div>

            {!isEditing ? (
              <Button type="button" onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
                <Pencil className="h-4 w-4" />
                Editar perfil
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Dados da conta</Badge>
              <Badge variant="outline" className="border-primary/20 bg-background/70 text-muted-foreground">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                CPF protegido
              </Badge>
              {isCoachAccount && isProPlan ? (
                <Badge className="border border-amber-400/30 bg-amber-400/12 text-amber-100 hover:bg-amber-400/12">
                  <Crown className="mr-1 h-3.5 w-3.5" />
                  Você já é PRO
                </Badge>
              ) : null}
            </div>
            {!isEditing ? (
              <Button type="button" onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
                <Pencil className="h-4 w-4" />
                Editar perfil
              </Button>
            ) : null}
          </div>
        )}

        {shouldShowUpgradeCta ? (
          <div id="profile-upgrade-cta" className="rounded-[28px] border border-primary/25 bg-primary/10 p-5 scroll-mt-24">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="outline" className="border-primary/30 bg-background/70 text-primary">
                  <Crown className="mr-1 h-3.5 w-3.5" />
                  Plano {currentPlanLabel}
                </Badge>
                <h3 className="mt-3 font-display text-xl font-semibold text-foreground">Ative o plano Pro na sua conta</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Seu plano atual é o {currentPlanLabel}. Faça o upgrade para liberar alunos ilimitados e manter seu acesso ativo sem depender do período de teste.
                </p>
              </div>

              <Button type="button" onClick={handleBecomePro} disabled={isUpgradingPlan} className="w-full lg:w-auto">
                <Crown className="h-4 w-4" />
                {isUpgradingPlan ? "Ativando Pro..." : "Tornar-se Pro"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
            <ProfileImageField
              previewUrl={effectiveAvatar}
              onFileChange={handleAvatarChange}
              onRemove={() => handleAvatarChange(null)}
              error={errors.avatarFile}
              disabled={!isEditing || isSubmitting}
              fullName={form.fullName || user.fullName}
            />

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Conta criada em</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatDate(user.createdAt)}</p>
              </div>

              <div className="rounded-[22px] border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <FileLock2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Documento protegido</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Este campo é somente leitura e também fica bloqueado na camada de persistência quando existir.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[28px] border border-border/60 bg-background/70 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="profile-fullName">Nome completo</Label>
                <Input
                  id="profile-fullName"
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  disabled={!isEditing || isSubmitting}
                  className={errors.fullName ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.fullName ? <p className="text-xs font-medium text-destructive">{errors.fullName}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email" className="flex items-center gap-2">
                  <span>E-mail</span>
                  <Badge variant="outline" className="border-border/70 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Protegido
                  </Badge>
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="profile-email" value={user.email} disabled className="pl-9 opacity-100" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-cpf" className="flex items-center gap-2">
                  <span>CPF</span>
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-[10px] uppercase tracking-[0.18em] text-primary">
                    Bloqueado
                  </Badge>
                </Label>
                <div className="relative">
                  <FileLock2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="profile-cpf" value={cpfDisplay} disabled className="pl-9 opacity-100" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-birthDate">Data de nascimento</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="profile-birthDate"
                    type="date"
                    max={maxBirthDate}
                    value={form.birthDate}
                    onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
                    disabled={!isEditing || isSubmitting}
                    className={`pl-9 ${errors.birthDate ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                </div>
                {errors.birthDate ? <p className="text-xs font-medium text-destructive">{errors.birthDate}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone">Telefone</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="profile-phone"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: formatPhone(event.target.value) }))}
                    disabled={!isEditing || isSubmitting}
                    placeholder="(11) 99999-9999"
                    className={`pl-9 ${errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                </div>
                {errors.phone ? <p className="text-xs font-medium text-destructive">{errors.phone}</p> : null}
              </div>

              {isCoachAccount && isProPlan ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="profile-pro-validity" className="flex items-center gap-2">
                    <span>Validade do PRO</span>
                    <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                      Ativo
                    </Badge>
                  </Label>
                  <div className="relative">
                    <Crown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200" />
                    <Input id="profile-pro-validity" value={proValidityDisplay} disabled className="pl-9 opacity-100" />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="profile-notes">Observações pessoais</Label>
                <Textarea
                  id="profile-notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  disabled={!isEditing || isSubmitting}
                  placeholder="Anotações curtas para referência do próprio profissional."
                  className={errors.notes ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.notes ? <p className="text-xs font-medium text-destructive">{errors.notes}</p> : null}
              </div>
            </div>

            {errors.form ? <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p> : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {isEditing ? (
                <>
                  <Button type="button" variant="outline" onClick={resetEditingState} disabled={isSubmitting}>
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="h-4 w-4" />
                    {isSubmitting ? "Salvando..." : "Salvar alteracoes"}
                  </Button>
                </>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
