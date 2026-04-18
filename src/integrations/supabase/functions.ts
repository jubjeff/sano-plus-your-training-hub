import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { getSupabaseClient, hasSupabaseRuntimeConfig } from "@/integrations/supabase/client";
import { getSupabaseFunctionsRegion } from "@/integrations/supabase/config";
import type { EdgeFunctionName } from "@/integrations/supabase/function-contracts";

type InvokeSupabaseEdgeFunctionOptions<TBody> = {
  body?: TBody;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  region?: string;
};

async function readFunctionsHttpErrorBody(error: FunctionsHttpError) {
  try {
    return await error.context.json();
  } catch {
    try {
      return await error.context.text();
    } catch {
      return null;
    }
  }
}

function extractEdgeErrorMessage(details: unknown) {
  if (typeof details === "string" && details.trim()) {
    return details.trim();
  }

  if (typeof details !== "object" || details === null) {
    return null;
  }

  if ("error" in details) {
    const nestedError = (details as { error?: { message?: unknown } }).error;
    if (nestedError && typeof nestedError.message === "string" && nestedError.message.trim()) {
      return nestedError.message.trim();
    }
  }

  if ("message" in details) {
    const message = (details as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return null;
}

export class SupabaseEdgeFunctionError extends Error {
  code: string;
  functionName: EdgeFunctionName | string;
  status: number | null;
  details?: unknown;

  constructor(params: {
    message: string;
    code?: string;
    functionName: EdgeFunctionName | string;
    status?: number | null;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "SupabaseEdgeFunctionError";
    this.code = params.code ?? "edge_function_error";
    this.functionName = params.functionName;
    this.status = params.status ?? null;
    this.details = params.details;
  }
}

export async function invokeSupabaseEdgeFunction<TResponse, TBody = unknown>(
  functionName: EdgeFunctionName | string,
  options: InvokeSupabaseEdgeFunctionOptions<TBody> = {},
): Promise<TResponse> {
  if (!hasSupabaseRuntimeConfig()) {
    throw new SupabaseEdgeFunctionError({
      functionName,
      code: "supabase_not_configured",
      message: "Supabase nao esta configurado para invocar Edge Functions neste ambiente.",
    });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: options.body,
    headers: options.headers,
    method: options.method,
    region: options.region ?? getSupabaseFunctionsRegion() ?? undefined,
  });

  if (!error) {
    return data as TResponse;
  }

  if (error instanceof FunctionsHttpError) {
    const details = await readFunctionsHttpErrorBody(error);
    const message = extractEdgeErrorMessage(details) ?? "A Edge Function retornou um erro.";

    throw new SupabaseEdgeFunctionError({
      functionName,
      code: "edge_function_http_error",
      message,
      status: error.context.status,
      details,
    });
  }

  if (error instanceof FunctionsRelayError) {
    throw new SupabaseEdgeFunctionError({
      functionName,
      code: "edge_function_relay_error",
      message: `Falha no relay da Edge Function: ${error.message}`,
    });
  }

  if (error instanceof FunctionsFetchError) {
    throw new SupabaseEdgeFunctionError({
      functionName,
      code: "edge_function_fetch_error",
      message: `Falha de rede ao chamar a Edge Function: ${error.message}`,
    });
  }

  throw new SupabaseEdgeFunctionError({
    functionName,
    code: "edge_function_unknown_error",
    message: error.message || "Falha desconhecida ao chamar a Edge Function.",
  });
}
