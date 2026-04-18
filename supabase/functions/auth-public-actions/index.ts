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
import { sendPasswordResetEmail } from "../_shared/email.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type AuthPublicAction = "request_password_reset";

type AuthPublicActionRequest = {
  action: AuthPublicAction;
  payload: Record<string, unknown>;
};

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeRedirectTo(value: unknown) {
  const redirectTo = String(value ?? "").trim();
  if (!redirectTo) {
    throw new EdgeHttpError("invalid_redirect_to", "A URL de redefinicao de senha e obrigatoria.", 400);
  }

  try {
    const url = new URL(redirectTo);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      throw new Error("invalid_protocol");
    }
    return redirectTo;
  } catch {
    throw new EdgeHttpError("invalid_redirect_to", "A URL de redefinicao de senha e invalida.", 400);
  }
}

function normalizeRequestPasswordResetPayload(payload: Record<string, unknown>) {
  const email = normalizeEmail(payload.email);
  const redirectTo = normalizeRedirectTo(payload.redirectTo);

  if (!email || !email.includes("@")) {
    throw new EdgeHttpError("invalid_email", "Informe um e-mail valido.", 400);
  }

  return { email, redirectTo };
}

async function requestPasswordReset(serviceRoleClient: ReturnType<typeof createServiceRoleClient>, payload: Record<string, unknown>) {
  const input = normalizeRequestPasswordResetPayload(payload);

  const { data, error } = await serviceRoleClient.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
    redirectTo: input.redirectTo,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("user not found") || message.includes("email not found") || message.includes("not found")) {
      return {
        exists: false,
        email: input.email,
        emailDelivery: {
          status: "skipped",
          provider: "none",
          message: "Nenhuma conta foi encontrada com este e-mail.",
        },
      };
    }

    throw new EdgeHttpError("password_reset_generate_failed", error.message, error.status ?? 400);
  }

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    throw new EdgeHttpError("password_reset_link_missing", "Nao foi possivel gerar o token de redefinicao.", 500);
  }

  const resetUrl = new URL(input.redirectTo);
  resetUrl.searchParams.set("token_hash", tokenHash);
  resetUrl.searchParams.set("type", "recovery");
  resetUrl.searchParams.set("email", input.email);

  const emailDelivery = await sendPasswordResetEmail({
    email: input.email,
    resetLink: resetUrl.toString(),
  });

  return {
    exists: true,
    email: input.email,
    emailDelivery,
  };
}

Deno.serve(async (request) => {
  const requestId = getRequestId(request);

  try {
    if (request.method === "OPTIONS") {
      return createOptionsResponse();
    }

    ensureMethod(request, ["POST"]);
    const serviceRoleClient = createServiceRoleClient();
    const body = await parseJsonBody<AuthPublicActionRequest>(request);

    if (body.action !== "request_password_reset") {
      throw new EdgeHttpError("unsupported_action", "Acao publica de autenticacao nao suportada.", 400);
    }

    const result = await requestPasswordReset(serviceRoleClient, body.payload ?? {});
    return createSuccessResponse(requestId, { result });
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
