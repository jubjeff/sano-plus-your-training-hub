type EdgeRuntimeEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  appUrl: string | null;
  resendApiKey: string | null;
  resendFromEmail: string | null;
  resendFromName: string | null;
  internalAutomationSecret: string | null;
  integrationWebhookSecret: string | null;
  secureOpsSecret: string | null;
};

let cachedEnv: EdgeRuntimeEnv | null = null;

function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`A variavel ${name} precisa estar configurada para a Edge Function.`);
  }

  return value;
}

function readOptionalEnv(name: string) {
  return Deno.env.get(name)?.trim() || null;
}

function requireFirstEnv(names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(`Uma das variaveis ${names.join(", ")} precisa estar configurada para a Edge Function.`);
}

export function getEdgeRuntimeEnv(): EdgeRuntimeEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseAnonKey: requireEnv("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: requireFirstEnv(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]),
    appUrl: readOptionalEnv("APP_URL"),
    resendApiKey: readOptionalEnv("RESEND_API_KEY"),
    resendFromEmail: readOptionalEnv("RESEND_FROM_EMAIL"),
    resendFromName: readOptionalEnv("RESEND_FROM_NAME"),
    internalAutomationSecret: readOptionalEnv("INTERNAL_AUTOMATION_SECRET"),
    integrationWebhookSecret: readOptionalEnv("INTEGRATION_WEBHOOK_SECRET"),
    secureOpsSecret: readOptionalEnv("SECURE_OPS_SECRET"),
  };

  return cachedEnv;
}
