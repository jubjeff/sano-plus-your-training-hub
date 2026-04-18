import { createClient } from "npm:@supabase/supabase-js@2";
import { getEdgeRuntimeEnv } from "./env.ts";

export function createUserScopedClient(authHeader: string) {
  const env = getEdgeRuntimeEnv();

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export function createServiceRoleClient() {
  const env = getEdgeRuntimeEnv();

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
