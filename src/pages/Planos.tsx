import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Crown, Loader2, Moon, Sparkles, Sun, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { getSupabaseClient } from "@/integrations/supabase";
import { EDGE_FUNCTION_NAMES } from "@/integrations/supabase/function-contracts";
import PixPaymentModal from "@/components/PixPaymentModal";

type Plano = {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  preco: number;
  periodo_dias: number;
  features: string[];
  destaque: boolean;
  ordem: number;
};

type PixInfo = {
  pixKey: string;
  pixKeyType: string;
  coachName: string;
  planName: string;
  amount: number;
};

const PLANO_ICONS: Record<string, React.ReactNode> = {
  basic: <Zap className="h-6 w-6" />,
  pro: <Sparkles className="h-6 w-6" />,
  premium: <Crown className="h-6 w-6" />,
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Planos() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const anamnesisId = searchParams.get("anamnese");
  // Professor que originou o link. Precisa atravessar o desvio para a anamnese,
  // senao a ficha nasce com teacher_id nulo: o aluno perde o botao de WhatsApp
  // e a notificacao cai no e-mail generico em vez de ir para o professor.
  const teacherId = searchParams.get("t");

  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPix, setLoadingPix] = useState<string | null>(null);
  const [pixInfo, setPixInfo] = useState<PixInfo | null>(null);
  const [selectedPlano, setSelectedPlano] = useState<Plano | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    async function fetchPlanos() {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("planos")
        .select("id,slug,nome,descricao,preco,periodo_dias,features,destaque,ordem")
        .eq("ativo", true)
        .order("ordem");

      if (!error && data) setPlanos(data as Plano[]);
      setLoading(false);
    }
    fetchPlanos();
  }, []);

  async function handleAssinar(plano: Plano) {
    // Sem anamnese ainda: manda preencher a ficha primeiro, carregando o
    // professor. A anamnese devolve o aluno para ca com ?anamnese=<id>&t=<t>.
    if (!anamnesisId) {
      navigate(teacherId ? `/anamnese?t=${encodeURIComponent(teacherId)}` : "/anamnese");
      return;
    }

    setLoadingPix(plano.id);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAMES.pixPaymentSubmit, {
        body: { mode: "info", anamnesisId, planoId: plano.id },
      });

      if (error) throw error;
      const result = data as { ok: boolean; data: PixInfo };
      setPixInfo(result.data);
      setSelectedPlano(plano);
      setModalOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar informações de pagamento.";
      if (msg.includes("pix_not_configured")) {
        alert("O personal ainda não configurou a chave PIX. Entre em contato.");
      } else {
        alert(msg);
      }
    } finally {
      setLoadingPix(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_28%)]" />

      <button
        onClick={toggleTheme}
        aria-label="Alternar tema"
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-[18px] border border-border/60 bg-card/80 text-muted-foreground transition-colors hover:text-foreground sm:right-6 sm:top-6"
      >
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Link to="/" className="font-display text-3xl font-bold tracking-tight text-foreground">
            Sano<span className="text-primary">+</span>
          </Link>
          <h1 className="mt-4 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            Escolha seu plano
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Todos os planos incluem acompanhamento personalizado. Cancele quando quiser.
          </p>
          {!anamnesisId && (
            <div className="mt-4 inline-block rounded-2xl border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-foreground">
              ⚠️ Você ainda não preencheu a anamnese. Ao clicar em "Assinar" será redirecionado para preenchê-la primeiro.
            </div>
          )}
        </div>

        {/* Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando planos...
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            {planos.map((plano) => {
              const isDestaqueCard = plano.destaque;
              const isLoading = loadingPix === plano.id;

              return (
                <div
                  key={plano.id}
                  className={`relative flex flex-col rounded-3xl border p-6 transition-shadow ${
                    isDestaqueCard
                      ? "border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(52,211,153,0.3),0_8px_32px_rgba(52,211,153,0.12)]"
                      : "border-border bg-card shadow-sm"
                  }`}
                >
                  {isDestaqueCard && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">
                        Mais popular
                      </span>
                    </div>
                  )}

                  <div className={`mb-4 flex items-center gap-3 ${isDestaqueCard ? "text-primary" : "text-foreground"}`}>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isDestaqueCard ? "bg-primary/15" : "bg-muted"}`}>
                      {PLANO_ICONS[plano.slug] ?? <Sparkles className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-display text-lg font-semibold">{plano.nome}</p>
                      <p className="text-xs text-muted-foreground">{plano.descricao}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <span className="font-display text-4xl font-bold text-foreground">
                      {formatBRL(plano.preco)}
                    </span>
                    <span className="ml-1 text-sm text-muted-foreground">/mês</span>
                  </div>

                  <ul className="mb-8 flex-1 space-y-2.5">
                    {(plano.features as string[]).map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleAssinar(plano)}
                    disabled={!!loadingPix}
                    variant={isDestaqueCard ? "default" : "outline"}
                    className="w-full"
                  >
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aguarde...</>
                    ) : (
                      "Assinar agora"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Pagamento via <span className="font-semibold text-foreground">PIX</span>
          {" "}· Aprovação em até 24h · Sem taxa de adesão
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Já tem acesso?{" "}
          <Link to="/" className="font-medium text-primary hover:text-primary/80">
            Entrar na plataforma
          </Link>
        </p>
      </div>

      {modalOpen && selectedPlano && pixInfo && anamnesisId && (
        <PixPaymentModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          pixKey={pixInfo.pixKey}
          coachName={pixInfo.coachName}
          planName={selectedPlano.nome}
          amount={selectedPlano.preco}
          anamnesisId={anamnesisId}
          planoId={selectedPlano.id}
        />
      )}
    </div>
  );
}
