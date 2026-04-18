import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequiredSupabaseRuntimeConfig, hasSupabaseRuntimeConfig } from "@/integrations/supabase/config";
import type { SupabaseDatabasePlaceholder } from "@/integrations/supabase/types";

let supabaseClient: SupabaseClient<SupabaseDatabasePlaceholder> | null = null;

function createSupabaseBrowserClient() {
  const config = getRequiredSupabaseRuntimeConfig();
  return createClient<SupabaseDatabasePlaceholder>(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseBrowserClient();
  }

  return supabaseClient;
}

export function getOptionalSupabaseClient() {
  if (!hasSupabaseRuntimeConfig()) {
    return null;
  }

  return getSupabaseClient();
}

export function resetSupabaseClient() {
  supabaseClient = null;
}

export { createSupabaseBrowserClient, hasSupabaseRuntimeConfig };
