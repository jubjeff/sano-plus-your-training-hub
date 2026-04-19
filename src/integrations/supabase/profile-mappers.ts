import type { AuthRole } from "@/types/auth";
import type { DatabaseUserProfile } from "@/types/profile";
import type { SupabaseProfileRecord, SupabaseProfileRole } from "@/integrations/supabase/types";

export function mapSupabaseProfileRoleToAuthRole(role: SupabaseProfileRole | null): AuthRole | null {
  if (role === "professor") {
    return "coach";
  }

  if (role === "aluno") {
    return "student";
  }

  return null;
}

export function mapAuthRoleToSupabaseProfileRole(role: AuthRole | null): SupabaseProfileRole | null {
  if (role === "coach") {
    return "professor";
  }

  if (role === "student") {
    return "aluno";
  }

  return null;
}

export function mapSupabaseProfileRecord(record: SupabaseProfileRecord): DatabaseUserProfile {
  return {
    id: record.id,
    email: record.email,
    fullName: record.full_name,
    avatarUrl: record.avatar_url,
    cpf: record.cpf,
    birthDate: record.birth_date,
    phone: record.phone,
    notes: record.notes,
    role: record.role,
    platformRole: record.platform_role,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
