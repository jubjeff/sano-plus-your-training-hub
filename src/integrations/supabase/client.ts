import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequiredSupabaseRuntimeConfig, hasSupabaseRuntimeConfig } from "@/integrations/supabase/config";
import type { Database } from "@/integrations/supabase/database.types";

let supabaseClient: SupabaseClient<Database> | null = null;

function createSupabaseBrowserClient() {
  const config = getRequiredSupabaseRuntimeConfig();
  return createClient<Database>(config.url, config.anonKey, {
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
