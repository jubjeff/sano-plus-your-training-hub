export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-secret, x-webhook-secret, x-secure-ops-secret, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export function withCorsHeaders(headers: HeadersInit = {}) {
  return {
    ...corsHeaders,
    ...headers,
  };
}
