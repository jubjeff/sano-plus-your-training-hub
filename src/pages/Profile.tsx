import { useEffect, useState } from "react";
import { Check, DollarSign, KeyRound, MessageCircle, Pencil, Save, X } from "lucide-react";
import MyProfileCard from "@/components/MyProfileCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/auth/use-auth";
import { getSupabaseClient } from "@/integrations/supabase";
import { PIX_KEY_TYPE_LABELS, type PixKeyType } from "@/lib/pix";

const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Configurações de recebimento: chave PIX + valor da mensalidade
function PaymentSettingsSection({ authUserId }: { authUserId: string }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estado salvo (vem do banco)
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [savedType, setSavedType] = useState<PixKeyType | null>(null);
  const [savedFee, setSavedFee] = useState<number | null>(null);
  const [savedWhatsapp, setSavedWhatsapp] = useState<string | null>(null);

  // Estado de edição
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("random");
  const [monthlyFee, setMonthlyFee] = useState(""); // sempre em centavos como string "15000" → exibe "150,00"
  const [whatsapp, setWhatsapp] = useState(""); // só dígitos, com DDI+DDD (ex: 5511987654321)

  // Converte centavos (string de dígitos) → "150,00"
  function centsToDisplay(cents: string): string {
    const digits = cents.replace(/\D/g, "").replace(/^0+/, "") || "0";
    const n = parseInt(digits, 10);
    return `${Math.floor(n / 100)},${String(n % 100).padStart(2, "0")}`;
  }

  // Converte "150,00" ou 150 (number) → string de centavos "15000"
  function valueToCents(v: number | string): string {
    if (typeof v === "number") return String(Math.round(v * 100));
    const clean = String(v).replace(/[^\d,]/g, "").replace(",", ".");
    const n = parseFloat(clean);
    return isNaN(n) ? "0" : String(Math.round(n * 100));
  }

  function handleFeeInput(raw: string) {
    // Mantém apenas dígitos e converte para centavos
    const digits = raw.replace(/\D/g, "").replace(/^0+/, "") || "";
    setMonthlyFee(digits);
  }

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase
      .from("teachers")
      .select("pix_key, pix_key_type, monthly_fee, whatsapp")
      .eq("user_id", authUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const key = data.pix_key as string | null;
        const type = (data.pix_key_type as PixKeyType | null) ?? "random";
        const fee = data.monthly_fee != null ? Number(data.monthly_fee) : null;
        const zap = (data.whatsapp as string | null) ?? null;
        setSavedKey(key);
        setSavedType(type);
        setSavedFee(fee);
        setSavedWhatsapp(zap);
        setPixKey(key ?? "");
        setPixKeyType(type);
        setMonthlyFee(fee != null ? valueToCents(fee) : "");
        setWhatsapp(zap ?? "");
      });
  }, [authUserId]);

  function handleEdit() {
    setPixKey(savedKey ?? "");
    setPixKeyType(savedType ?? "random");
    setMonthlyFee(savedFee != null ? valueToCents(savedFee) : "");
    setWhatsapp(savedWhatsapp ?? "");
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
  }

  async function handleSave() {
    if (!pixKey.trim()) { toast.error("Informe a chave PIX."); return; }

    // Converte centavos → valor decimal (ex: "15000" → 150.00)
    const feeNum = monthlyFee
      ? parseFloat((parseInt(monthlyFee || "0", 10) / 100).toFixed(2))
      : null;

    // Guardado só com dígitos (DDI+DDD+número) porque é o formato que o
    // link wa.me exige na tela pública de anamnese.
    const whatsappDigits = whatsapp.replace(/\D/g, "");
    if (whatsappDigits && (whatsappDigits.length < 12 || whatsappDigits.length > 13)) {
      toast.error("WhatsApp inválido. Use DDI + DDD + número (ex: 5511987654321).");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error, data } = await supabase
        .from("teachers")
        .update({
          pix_key: pixKey.trim(),
          pix_key_type: pixKeyType,
          monthly_fee: feeNum,
          whatsapp: whatsappDigits || null,
        })
        .eq("user_id", authUserId)
        .select("id");

      if (error) throw error;
      // Sem erro mas sem linhas → registro do professor ainda não existe
      if (!data || data.length === 0) {
        toast.error("Perfil de professor não encontrado. Faça logout e entre novamente.");
        return;
      }

      setSavedKey(pixKey.trim());
      setSavedType(pixKeyType);
      setSavedFee(feeNum);
      setSavedWhatsapp(whatsappDigits || null);
      setEditing(false);
      toast.success("Configurações de recebimento salvas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const isConfigured = !!savedKey;

  return (
    <section className="section-shell overflow-hidden">
      <div className="p-4 sm:p-5 lg:p-6">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">Configurações de recebimento</h3>
              <p className="text-xs text-muted-foreground">Chave PIX e valor da mensalidade exibidos aos alunos.</p>
            </div>
          </div>
          {!editing && (
            <Button type="button" variant="outline" size="sm" onClick={handleEdit}>
              <Pencil className="h-3.5 w-3.5" />
              {isConfigured ? "Editar" : "Configurar"}
            </Button>
          )}
        </div>

        {/* Visualização */}
        {!editing && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* Chave PIX */}
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${savedKey ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"}`}>
              <KeyRound className={`h-4 w-4 shrink-0 ${savedKey ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Chave PIX</p>
                {savedKey ? (
                  <>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{savedType ? PIX_KEY_TYPE_LABELS[savedType] : ""}</p>
                    <p className="truncate text-sm font-semibold text-foreground">{savedKey}</p>
                  </>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">Não configurada</p>
                )}
              </div>
              {savedKey && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
            </div>

            {/* Valor da mensalidade */}
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${savedFee != null ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"}`}>
              <DollarSign className={`h-4 w-4 shrink-0 ${savedFee != null ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Mensalidade</p>
                {savedFee != null ? (
                  <p className="mt-0.5 text-lg font-bold text-foreground">{formatBRL(savedFee)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">Não definida</p>
                )}
              </div>
              {savedFee != null && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
            </div>

            {/* WhatsApp dos vídeos de avaliação */}
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${savedWhatsapp ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"}`}>
              <MessageCircle className={`h-4 w-4 shrink-0 ${savedWhatsapp ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">WhatsApp dos vídeos</p>
                {savedWhatsapp ? (
                  <p className="mt-0.5 truncate text-sm font-medium text-foreground">+{savedWhatsapp}</p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">Não configurado</p>
                )}
              </div>
              {savedWhatsapp && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
            </div>

            {!isConfigured && (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Configure a chave PIX para que seus alunos possam pagar pelo app.
              </p>
            )}
            {!savedWhatsapp && (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Configure o WhatsApp para receber os vídeos de avaliação dos seus alunos.
              </p>
            )}
          </div>
        )}

        {/* Formulário de edição */}
        {editing && (
          <div className="mt-5 space-y-5">
            {/* Valor da mensalidade */}
            <div className="space-y-2">
              <Label htmlFor="monthly-fee-input">Valor da mensalidade</Label>
              <div className="flex items-center rounded-xl border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="select-none pl-3 text-sm font-medium text-muted-foreground">R$</span>
                <input
                  id="monthly-fee-input"
                  inputMode="numeric"
                  value={monthlyFee ? centsToDisplay(monthlyFee) : ""}
                  onChange={(e) => handleFeeInput(e.target.value)}
                  placeholder="0,00"
                  className="h-10 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">Este valor será exibido no QR code e na tela de pagamento do aluno.</p>
            </div>

            {/* WhatsApp para recebimento dos vídeos de avaliação */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp-input">WhatsApp para os vídeos de avaliação</Label>
              <input
                id="whatsapp-input"
                inputMode="numeric"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 13))}
                placeholder="5511987654321"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <p className="text-xs text-muted-foreground">
                DDI + DDD + número, só dígitos. Ao concluir a anamnese, o aluno recebe um botão para te enviar
                os vídeos do Deep Squat neste número. Sem isso, ele verá apenas a orientação de entrar em contato.
              </p>
            </div>

            <div className="border-t border-border/60 pt-5 space-y-4">
              <p className="text-sm font-medium text-foreground">Chave PIX para recebimento</p>

              {/* Tipo de chave */}
              <div className="space-y-2">
                <Label>Tipo de chave</Label>
                <div className="flex flex-wrap gap-2">
                  {PIX_KEY_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setPixKeyType(t.value)}
                      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                        pixKeyType === t.value
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chave */}
              <div className="space-y-2">
                <Label htmlFor="pix-key-input">Chave PIX</Label>
                <Input
                  id="pix-key-input"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder={
                    pixKeyType === "cpf" ? "000.000.000-00"
                    : pixKeyType === "cnpj" ? "00.000.000/0000-00"
                    : pixKeyType === "email" ? "seu@email.com"
                    : pixKeyType === "phone" ? "+55 (11) 99999-9999"
                    : "Chave aleatória (UUID)"
                  }
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4" /> Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar configurações"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="page-shell">
      {user?.role === "coach" && user.teacherHasActiveAccess === false ? (
        <section className="section-shell border-warning/30 bg-warning/10 p-4 sm:p-5 lg:p-6">
          <p className="text-sm font-semibold text-foreground">Acesso principal bloqueado</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {user.teacherAccessMessage || "Seu período de teste expirou. Faça upgrade para o plano Pro para continuar."}
          </p>
        </section>
      ) : null}

      <section className="section-shell overflow-hidden">
        <div className="p-5 sm:p-6 lg:p-8">
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Meu Perfil
          </span>
          <div className="mt-4">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Gerencie seus dados pessoais</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Visualize e atualize as informações permitidas da sua conta com segurança. Campos críticos, como documento e e-mail, permanecem protegidos quando existirem.
            </p>
          </div>
        </div>
      </section>

      <MyProfileCard showHeader={false} />

      {user?.role === "coach" && (
        <PaymentSettingsSection authUserId={user.id} />
      )}
    </div>
  );
}
