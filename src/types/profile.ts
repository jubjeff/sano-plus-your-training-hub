import type { AuthRole } from "@/types/auth";
import type { SupabaseProfileRole } from "@/integrations/supabase/types";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  notes?: string | null;
  role: AuthRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseUserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  cpf: string | null;
  birthDate: string | null;
  phone: string | null;
  notes: string | null;
  role: SupabaseProfileRole | null;
  createdAt: string;
  updatedAt: string;
}
