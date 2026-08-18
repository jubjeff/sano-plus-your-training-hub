import { getEdgeRuntimeEnv } from "./env.ts";
import { EdgeHttpError } from "./http.ts";

const MP_API = "https://api.mercadopago.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MpPaymentStatus =
  | "approved" | "pending" | "rejected" | "cancelled"
  | "refunded" | "authorized" | "in_process" | "in_mediation" | "charged_back";

export type MpPayment = {
  id: number;
  status: MpPaymentStatus;
  status_detail: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  payment_method_id: string;
  payment_type_id: string;
  date_created: string;
  date_approved: string | null;
  payer: { email: string; first_name?: string; last_name?: string };
};

export type CreatePreferenceInput = {
  items: Array<{ title: string; quantity: number; unit_price: number; currency_id?: string }>;
  external_reference: string;
  back_urls: { success: string; pending: string; failure: string };
  notification_url: string;
  auto_return?: "approved" | "all";
  statement_descriptor?: string;
  metadata?: Record<string, unknown>;
};

export type MpPreference = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
};

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function createMpPreference(input: CreatePreferenceInput): Promise<MpPreference> {
  const { mpAccessToken } = getEdgeRuntimeEnv();
  if (!mpAccessToken) throw new EdgeHttpError("mp_not_configured", "MP_ACCESS_TOKEN nao configurado.", 500);

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpAccessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.external_reference,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EdgeHttpError("mp_preference_failed", `Falha ao criar preferencia MP (${res.status}): ${body}`, 502);
  }

  return res.json();
}

export async function getMpPayment(paymentId: string | number): Promise<MpPayment> {
  const { mpAccessToken } = getEdgeRuntimeEnv();
  if (!mpAccessToken) throw new EdgeHttpError("mp_not_configured", "MP_ACCESS_TOKEN nao configurado.", 500);

  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpAccessToken}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EdgeHttpError("mp_payment_fetch_failed", `Falha ao buscar pagamento MP (${res.status}): ${body}`, 502);
  }

  return res.json();
}

// ─── Webhook signature (SubtleCrypto — sem deps externas) ────────────────────

export async function validateMpSignature(params: {
  requestId: string;
  dataId: string;
  timestamp: string;
  v1: string;
  secret: string;
}): Promise<boolean> {
  try {
    const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${params.timestamp}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(params.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return computed === params.v1;
  } catch {
    return false;
  }
}

// ─── External reference helpers ───────────────────────────────────────────────

export function buildExternalRef(anamnesisId: string, planoId: string): string {
  return `ana_${anamnesisId}|pla_${planoId}`;
}

export function parseExternalRef(ref: string): { anamnesisId: string; planoId: string } | null {
  const m = ref.match(/^ana_([^|]+)\|pla_(.+)$/);
  if (!m) return null;
  return { anamnesisId: m[1], planoId: m[2] };
}
