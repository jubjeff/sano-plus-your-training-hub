export type SupabaseProfileRole = "professor" | "aluno";
export type SupabasePlatformRole = "default" | "dev_admin";

export interface SupabaseProfileRecord {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  notes: string | null;
  role: SupabaseProfileRole | null;
  platform_role: SupabasePlatformRole | null;
  created_at: string;
  updated_at: string;
}
