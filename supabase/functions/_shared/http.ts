import { corsHeaders } from "./cors.ts";

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), { ...init, headers });
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return jsonResponse(
    {
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status },
  );
}
