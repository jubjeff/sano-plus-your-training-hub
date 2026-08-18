import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, ImageIcon, RefreshCw, TrendingUp, Users, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { getSupabaseClient } from "@/integrations/supabase";
import { EDGE_FUNCTION_NAMES } from "@/integrations/supabase/function-contracts";

type AssinaturaStatus = "pendente" | "ativo" | "cancelado" | "reembolsado" | "expirado" | "recusado";
type ProofStatus = "none" | "submitted" | "approved" | "rejected";

type Assinatura = {
  id: string;
  status: AssinaturaStatus;
  valor_cobrado: number | null;
  data_inicio: string | null;
  data_renovacao: string | null;
  data_cancelamento: string | null;
  metodo_pagamento: string | null;
  mp_payment_id: string | null;
  payer_note: string | null;
  payment_proof_url: string | null;
  payment_proof_status: ProofStatus;
  created_at: string;
  planos: { nome: string; slug: string } | null;
  // Dados do aluno — via anamnese (primeiro acesso) ou via students (renovação)
  anamneses: { full_name: string; email: string } | null;
  aluno: { full_name: string; email: string } | null;
};

const STATUS_CONFIG: Record<AssinaturaStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  ativo: { label: "Ativo", variant: "default" },
  pendente: { label: "Pendente", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  reembolsado: { label: "Reembolsado", variant: "outline" },
  expirado: { label: "Expirado", variant: "outline" },
  recusado: { label: "Recusado", variant: "destructive" },
};

type StatusFilter = "all" | AssinaturaStatus;

function formatBRL(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

function getStudentName(a: Assinatura) {
  return a.anamneses?.full_name ?? a.aluno?.full_name ?? "—";
}

function getStudentEmail(a: Assinatura) {
  return a.anamneses?.email ?? a.aluno?.email ?? "—";
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp)/i.test(url) || url.includes("image");
}

// Modal de visualização do comprovante
function ProofModal({ url, onClose }: { url: string; onClose: () => void }) {
  const isImg = isImageUrl(url);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 max-h-[90vh] max-w-2xl w-full overflow-hidden rounded-[24px] border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold text-foreground">Comprovante de pagamento</p>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          {isImg ? (
            <img src={url} alt="Comprovante" className="mx-auto max-h-[70vh] rounded-xl object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Este comprovante é um PDF.</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Abrir PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "ativo", label: "Ativas" },
  { value: "pendente", label: "Pendentes" },
  { value: "cancelado", label: "Canceladas" },
  { value: "expirado", label: "Expiradas" },
  { value: "recusado", label: "Recusadas" },
];

export default function Assinaturas() {
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [proofModal, setProofModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("assinaturas")
        .select(`
          id, status, valor_cobrado, data_inicio, data_renovacao, data_cancelamento,
          metodo_pagamento, mp_payment_id, payer_note, payment_proof_url,
          payment_proof_status, created_at,
          planos(nome, slug),
          anamneses(full_name, email),
          aluno:students!aluno_id(full_name, email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssinaturas((data ?? []) as Assinatura[]);
    } catch {
      toast.error("Erro ao carregar assinaturas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(id: string, newStatus: AssinaturaStatus) {
    setUpdating(id);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("assinaturas")
        .update({ status: newStatus, ...(newStatus === "cancelado" ? { data_cancelamento: new Date().toISOString() } : {}) })
        .eq("id", id);
      if (error) throw error;
      setAssinaturas((prev) => prev.map((a) => a.id === id ? { ...a, status: newStatus } : a));
      toast.success("Status atualizado.");
    } catch {
      toast.error("Erro ao atualizar.");
    } finally {
      setUpdating(null);
    }
  }

  async function handleApprovePix(id: string) {
    const name = getStudentName(assinaturas.find(a => a.id === id)!);
    if (!confirm(`Confirmar aprovação do pagamento de ${name}?\n\nO acesso será renovado e um e-mail de confirmação será enviado ao aluno.`)) return;

    setUpdating(id);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAMES.pixApprovePayment, {
        body: { assinaturaId: id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error?.message ?? "Erro desconhecido.");
      toast.success("Pagamento aprovado! Aluno notificado por e-mail.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aprovar pagamento.");
    } finally {
      setUpdating(null);
    }
  }

  const filtered = filter === "all" ? assinaturas : assinaturas.filter((a) => a.status === filter);
  const ativos = assinaturas.filter((a) => a.status === "ativo");
  const mrr = ativos.reduce((sum, a) => sum + (a.valor_cobrado ?? 0), 0);
  const pendingProofs = assinaturas.filter((a) => a.status === "pendente" && a.payment_proof_status === "submitted");
  const canceladosMes = assinaturas.filter((a) => {
    if (a.status !== "cancelado" || !a.data_cancelamento) return false;
    const d = new Date(a.data_cancelamento);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="page-shell">
      {proofModal && <ProofModal url={proofModal} onClose={() => setProofModal(null)} />}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Assinaturas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pagamentos e assinaturas dos alunos.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="self-start">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Alerta de comprovantes aguardando aprovação */}
      {pendingProofs.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            ⚠️ {pendingProofs.length} comprovante{pendingProofs.length > 1 ? "s" : ""} aguardando sua aprovação
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Verifique o extrato da sua conta PIX e aprove os pagamentos correspondentes abaixo.
          </p>
        </div>
      )}

      {/* Totalizadores */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="section-shell p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">MRR</p>
            <p className="text-xl font-bold text-foreground">{formatBRL(mrr)}</p>
          </div>
        </div>
        <div className="section-shell p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assinantes ativos</p>
            <p className="text-xl font-bold text-foreground">{ativos.length}</p>
          </div>
        </div>
        <div className="section-shell p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/15">
            <XCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cancelamentos no mês</p>
            <p className="text-xl font-bold text-foreground">{canceladosMes}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-[11px] font-bold">
              {f.value === "all" ? assinaturas.length : assinaturas.filter((a) => a.status === f.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="font-medium text-foreground">Nenhuma assinatura encontrada</p>
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "Compartilhe o link /planos com seus alunos para receber as primeiras assinaturas."
              : "Nenhuma assinatura com este status."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const cfg = STATUS_CONFIG[a.status];
            const isPendingProof = a.status === "pendente" && a.payment_proof_status === "submitted";
            const hasProof = !!a.payment_proof_url;
            const studentName = getStudentName(a);
            const studentEmail = getStudentEmail(a);
            const isImg = hasProof && isImageUrl(a.payment_proof_url!);

            return (
              <div
                key={a.id}
                className={`section-shell overflow-hidden transition-shadow ${isPendingProof ? "border-warning/40 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]" : ""}`}
              >
                <div className="flex flex-col gap-0 sm:flex-row">
                  {/* Thumbnail do comprovante (lateral esquerda) */}
                  {hasProof && (
                    <button
                      type="button"
                      onClick={() => setProofModal(a.payment_proof_url!)}
                      className="group relative shrink-0 sm:w-28 h-24 sm:h-auto overflow-hidden bg-muted/30 hover:bg-muted/60 transition-colors border-b sm:border-b-0 sm:border-r border-border/60 flex items-center justify-center"
                      title="Ver comprovante"
                    >
                      {isImg ? (
                        <img
                          src={a.payment_proof_url!}
                          alt="Comprovante"
                          className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                      ) : (
                        <FileText className="h-8 w-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                        <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {isPendingProof && (
                        <div className="absolute top-1.5 left-1.5 rounded-md bg-warning px-1.5 py-0.5 text-[10px] font-bold text-white">
                          NOVO
                        </div>
                      )}
                    </button>
                  )}

                  {/* Conteúdo principal */}
                  <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
                    <div className="flex-1 min-w-0">
                      {/* Nome + badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{studentName}</p>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        {a.planos?.nome && (
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                            {a.planos.nome}
                          </span>
                        )}
                        {a.metodo_pagamento === "pix" && (
                          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                            PIX
                          </span>
                        )}
                        {isPendingProof && (
                          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning-foreground dark:text-yellow-300">
                            Comprovante enviado
                          </span>
                        )}
                      </div>

                      {/* E-mail */}
                      <p className="mt-0.5 text-sm text-muted-foreground">{studentEmail}</p>

                      {/* Detalhes */}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span><strong className="text-foreground">Valor:</strong> {formatBRL(a.valor_cobrado)}/mês</span>
                        <span><strong className="text-foreground">Início:</strong> {formatDate(a.data_inicio)}</span>
                        <span><strong className="text-foreground">Renovação:</strong> {formatDate(a.data_renovacao)}</span>
                        {a.metodo_pagamento && <span><strong className="text-foreground">Método:</strong> {a.metodo_pagamento}</span>}
                        {a.mp_payment_id && <span className="font-mono text-[10px]">MP#{a.mp_payment_id}</span>}
                      </div>

                      {/* Observação do aluno */}
                      {a.payer_note && (
                        <p className="mt-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
                          <strong className="not-italic text-foreground">Obs. do aluno:</strong> {a.payer_note}
                        </p>
                      )}

                      {/* Comprovante sem thumbnail (PDF) */}
                      {hasProof && !isImg && (
                        <button
                          type="button"
                          onClick={() => setProofModal(a.payment_proof_url!)}
                          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> Ver comprovante (PDF)
                        </button>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      {isPendingProof && (
                        <Button
                          size="sm"
                          disabled={updating === a.id}
                          onClick={() => handleApprovePix(a.id)}
                          className="w-full sm:w-auto"
                        >
                          {updating === a.id ? (
                            <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />Aprovando…</>
                          ) : (
                            "✓ Aprovar pagamento"
                          )}
                        </Button>
                      )}
                      {a.status === "ativo" && (
                        <button
                          type="button"
                          disabled={updating === a.id}
                          onClick={() => handleStatusChange(a.id, "cancelado")}
                          className="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50 sm:w-auto"
                        >
                          Cancelar
                        </button>
                      )}
                      {(a.status === "cancelado" || a.status === "expirado") && (
                        <button
                          type="button"
                          disabled={updating === a.id}
                          onClick={() => handleStatusChange(a.id, "ativo")}
                          className="w-full rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 sm:w-auto"
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
