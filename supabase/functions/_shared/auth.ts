import { EdgeHttpError } from "./http.ts";
import { createServiceRoleClient } from "./supabase.ts";

type AuthenticatedFunctionContext = {
  authHeader: string;
  user: {
    id: string;
    email: string | null;
  };
  profile: {
    id: string;
    email: string;
    role: string | null;
  } | null;
};

export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedFunctionContext> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    throw new EdgeHttpError("missing_authorization", "Cabecalho Authorization ausente.", 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const serviceRoleClient = createServiceRoleClient();

  if (!token) {
    throw new EdgeHttpError("invalid_authorization", "Token de acesso invalido.", 401);
  }

  const {
    data: { user },
    error: authError,
  } = await serviceRoleClient.auth.getUser(token);

  if (authError || !user) {
    throw new EdgeHttpError("invalid_session", authError?.message ?? "Sessao invalida ou expirada.", 401);
  }

  const { data: profile, error: profileError } = await serviceRoleClient
    .from("profiles")
    .select("id,email,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new EdgeHttpError("profile_lookup_failed", "Nao foi possivel carregar o perfil autenticado.", 500, {
      reason: profileError.message,
      userId: user.id,
    });
  }

  return {
    authHeader,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    profile: profile
      ? {
          id: profile.id as string,
          email: profile.email as string,
          role: (profile.role as string | null | undefined) ?? null,
        }
      : null,
  };
}

export async function requireCoachUser(request: Request) {
  const context = await requireAuthenticatedUser(request);

  if (context.profile?.role !== "professor") {
    throw new EdgeHttpError("forbidden", "Apenas professores autenticados podem usar esta funcao.", 403);
  }

  return context;
}

export function requireSharedSecret(request: Request, headerName: string, expectedSecret: string | null) {
  if (!expectedSecret) {
    throw new EdgeHttpError("missing_secret_configuration", `Segredo ${headerName} nao configurado no ambiente.`, 500);
  }

  const receivedSecret = request.headers.get(headerName)?.trim();
  if (!receivedSecret || receivedSecret !== expectedSecret) {
    throw new EdgeHttpError("invalid_shared_secret", `Cabecalho ${headerName} invalido.`, 401);
  }
}
