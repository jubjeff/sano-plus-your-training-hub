type SupabaseRuntimeConfig = {
  url: string;
  anonKey: string;
  functionsRegion: string | null;
};

export const SUPABASE_ENV_KEYS = {
  url: "VITE_SUPABASE_URL",
  anonKey: "VITE_SUPABASE_ANON_KEY",
  appUrl: "VITE_APP_URL",
  functionsRegion: "VITE_SUPABASE_FUNCTIONS_REGION",
} as const;

export function getSupabaseRuntimeConfig(): SupabaseRuntimeConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const functionsRegion = import.meta.env.VITE_SUPABASE_FUNCTIONS_REGION?.trim() || null;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey, functionsRegion };
}

export function hasSupabaseRuntimeConfig() {
  return getSupabaseRuntimeConfig() !== null;
}

export function getRequiredSupabaseRuntimeConfig(): SupabaseRuntimeConfig {
  const config = getSupabaseRuntimeConfig();

  if (!config) {
    throw new Error(`As variaveis ${SUPABASE_ENV_KEYS.url} e ${SUPABASE_ENV_KEYS.anonKey} precisam estar configuradas.`);
  }

  return config;
}

export function getSupabaseAppUrl() {
  return import.meta.env.VITE_APP_URL?.trim() || null;
}

export function getSupabaseFunctionsRegion() {
  return getSupabaseRuntimeConfig()?.functionsRegion ?? null;
}
