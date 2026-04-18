import { withCorsHeaders } from "./cors.ts";

export class EdgeHttpError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "EdgeHttpError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function ensureMethod(request: Request, allowedMethods: string[]) {
  if (!allowedMethods.includes(request.method.toUpperCase())) {
    throw new EdgeHttpError("method_not_allowed", "Metodo nao permitido para esta funcao.", 405, {
      allowedMethods,
      receivedMethod: request.method,
    });
  }
}

export function createOptionsResponse() {
  return new Response("ok", {
    headers: withCorsHeaders(),
  });
}

export function createJsonResponse(payload: unknown, init: ResponseInit = {}) {
  const headers = new Headers(withCorsHeaders(init.headers));
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

export function createSuccessResponse<TData>(requestId: string, data: TData, status = 200) {
  return createJsonResponse(
    {
      ok: true,
      requestId,
      data,
    },
    { status },
  );
}

export function createErrorResponse(requestId: string, error: EdgeHttpError) {
  return createJsonResponse(
    {
      ok: false,
      requestId,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    },
    { status: error.status },
  );
}

export function normalizeEdgeError(error: unknown) {
  if (error instanceof EdgeHttpError) {
    return error;
  }

  if (error instanceof Error) {
    return new EdgeHttpError("unexpected_error", error.message, 500);
  }

  return new EdgeHttpError("unexpected_error", "Falha inesperada na Edge Function.", 500);
}

export async function parseJsonBody<TBody>(request: Request): Promise<TBody> {
  try {
    return (await request.json()) as TBody;
  } catch {
    throw new EdgeHttpError("invalid_json", "Corpo JSON invalido.", 400);
  }
}
