export type SupabaseProfileRole = "professor" | "aluno";

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
  created_at: string;
  updated_at: string;
}

export interface SupabaseDatabasePlaceholder {
  public: {
    Tables: {
      profiles: {
        Row: SupabaseProfileRecord;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          cpf?: string | null;
          birth_date?: string | null;
          phone?: string | null;
          notes?: string | null;
          role?: SupabaseProfileRole | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          cpf?: string | null;
          birth_date?: string | null;
          phone?: string | null;
          notes?: string | null;
          role?: SupabaseProfileRole | null;
          updated_at?: string;
        };
      };
      teachers: {
        Row: {
          id: string;
          user_id: string;
          onboarding_completed: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          onboarding_completed?: boolean;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          onboarding_completed?: boolean;
          metadata?: Record<string, unknown>;
          updated_at?: string;
        };
      };
      teacher_subscriptions: {
        Row: {
          id: string;
          teacher_id: string;
          plan_type: string;
          status: string;
          access_blocked: boolean;
          billing_provider: string | null;
          external_subscription_id: string | null;
          started_at: string;
          current_period_starts_at: string | null;
          current_period_ends_at: string | null;
          trial_started_at: string | null;
          trial_ends_at: string | null;
          trial_granted: boolean;
          canceled_at: string | null;
          blocked_reason: string | null;
          student_limit: number | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      students: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      workout_templates: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      student_workout_plans: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      student_check_ins: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      coach_alert_reads: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      integration_events: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
  };
}
