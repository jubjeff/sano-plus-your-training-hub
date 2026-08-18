// STATUS: PAUSADO — implementado e deployado, mas NAO plugado ao frontend.
// O unico fluxo de pagamento ativo e o PIX manual: src/pages/Planos.tsx chama
// `pix-payment-submit`, e a aprovacao do professor passa por `pix-approve-payment`.
// Nenhum codigo do app invoca esta funcao hoje.
//
// ATENCAO: `mp-webhook` e `pix-approve-payment` provisionam as MESMAS tabelas
// (teachers, profiles, students, assinaturas, anamneses). Qualquer mudanca na
// regra de provisionamento precisa ser feita nos dois lugares enquanto o
// Mercado Pago existir. Ver secao "Estado do Codigo" no CLAUDE.md.

import {
  createErrorResponse,
  createOptionsResponse,
  createSuccessResponse,
  EdgeHttpError,
  ensureMethod,
  getRequestId,
  normalizeEdgeError,
  parseJsonBody,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";
import { buildExternalRef, createMpPreference } from "../_shared/mercadopago.ts";

type Body = { anamnesisId: string; planoId: string };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return createOptionsResponse();

  const requestId = getRequestId(request);

  try {
    ensureMethod(request, ["POST"]);

    const { anamnesisId, planoId } = await parseJsonBody<Body>(request);

    if (!anamnesisId?.trim() || !planoId?.trim()) {
      throw new EdgeHttpError("missing_params", "anamnesisId e planoId sao obrigatorios.", 400);
    }

    const db = createServiceRoleClient();
    const env = getEdgeRuntimeEnv();
    const appUrl = (env.appUrl ?? "https://sanoplus.online").replace(/\/$/, "");

    // Verifica plano ativo
    const { data: plano, error: planoErr } = await db
      .from("planos")
      .select("id, nome, preco, ativo")
      .eq("id", planoId)
      .maybeSingle();

    if (planoErr || !plano || !plano.ativo) {
      throw new EdgeHttpError("plano_not_found", "Plano nao encontrado ou inativo.", 404);
    }

    // Verifica anamnese
    const { data: anamnese, error: anamneseErr } = await db
      .from("anamneses")
      .select("id, full_name, email, teacher_id")
      .eq("id", anamnesisId)
      .maybeSingle();

    if (anamneseErr || !anamnese) {
      throw new EdgeHttpError("anamnese_not_found", "Anamnese nao encontrada.", 404);
    }

    // Idempotência: já existe assinatura ativa/pendente?
    const { data: existing } = await db
      .from("assinaturas")
      .select("id, status, mp_preference_id, mp_external_reference")
      .eq("anamnese_id", anamnesisId)
      .in("status", ["ativo", "pendente"])
      .maybeSingle();

    if (existing?.status === "ativo") {
      throw new EdgeHttpError("already_active", "Esta anamnese ja possui assinatura ativa.", 409);
    }

    // Se já tem preferência pendente, retorna a existente
    if (existing?.status === "pendente" && existing.mp_preference_id) {
      const isSandbox = !(env.mpAccessToken ?? "").startsWith("APP_USR");
      const sandboxPoint = `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=${existing.mp_preference_id}`;
      const livePoint = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${existing.mp_preference_id}`;

      return createSuccessResponse(requestId, {
        preferenceId: existing.mp_preference_id,
        initPoint: isSandbox ? sandboxPoint : livePoint,
        sandboxInitPoint: sandboxPoint,
        reused: true,
      });
    }

    const externalRef = buildExternalRef(anamnesisId, planoId);

    const preference = await createMpPreference({
      items: [{
        title: `Sano+ ${plano.nome}`,
        quantity: 1,
        unit_price: Number(plano.preco),
        currency_id: "BRL",
      }],
      external_reference: externalRef,
      back_urls: {
        success: `${appUrl}/pagamento/sucesso`,
        pending: `${appUrl}/pagamento/pendente`,
        failure: `${appUrl}/pagamento/erro`,
      },
      notification_url: `${env.supabaseUrl}/functions/v1/mp-webhook`,
      auto_return: "approved",
      statement_descriptor: "SANO+",
      metadata: {
        anamnesisId,
        planoId,
        alunoEmail: anamnese.email,
        alunoNome: anamnese.full_name,
      },
    });

    // Cria/atualiza registro em assinaturas
    if (existing?.status === "pendente") {
      await db
        .from("assinaturas")
        .update({
          mp_preference_id: preference.id,
          mp_external_reference: externalRef,
          plano_id: planoId,
          valor_cobrado: Number(plano.preco),
        })
        .eq("id", existing.id);
    } else {
      await db.from("assinaturas").insert({
        anamnese_id: anamnesisId,
        plano_id: planoId,
        teacher_id: anamnese.teacher_id ?? null,
        status: "pendente",
        mp_preference_id: preference.id,
        mp_external_reference: externalRef,
        valor_cobrado: Number(plano.preco),
      });
    }

    return createSuccessResponse(requestId, {
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      reused: false,
    });
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
