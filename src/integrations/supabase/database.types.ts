export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      anamneses: {
        Row: {
          age: number
          available_days_per_week: number
          available_equipment: string[]
          created_at: string
          deep_squat_obs: string | null
          deep_squat_score: number | null
          deep_squat_video_frontal_url: string | null
          deep_squat_video_lateral_url: string | null
          deep_squat_video_posterior_url: string | null
          email: string
          experience_level: string
          fms_hurdle_obs: string | null
          fms_hurdle_step_direito: number | null
          fms_hurdle_step_esquerdo: number | null
          fms_lunge_direito: number | null
          fms_lunge_esquerdo: number | null
          fms_lunge_obs: string | null
          fms_score_total: number | null
          foto_frontal_url: string | null
          foto_lateral_url: string | null
          foto_posterior_url: string | null
          full_name: string
          goal: string
          has_trained_before: boolean
          id: string
          injury_history: string
          notes: string | null
          phone: string
          preferred_time: string
          reviewed_at: string | null
          session_duration: string
          status: string
          stopped_training_duration: string | null
          student_id: string | null
          submitted_at: string
          teacher_id: string | null
          updated_at: string
          weight_kg: number
        }
        Insert: {
          age: number
          available_days_per_week: number
          available_equipment?: string[]
          created_at?: string
          deep_squat_obs?: string | null
          deep_squat_score?: number | null
          deep_squat_video_frontal_url?: string | null
          deep_squat_video_lateral_url?: string | null
          deep_squat_video_posterior_url?: string | null
          email: string
          experience_level: string
          fms_hurdle_obs?: string | null
          fms_hurdle_step_direito?: number | null
          fms_hurdle_step_esquerdo?: number | null
          fms_lunge_direito?: number | null
          fms_lunge_esquerdo?: number | null
          fms_lunge_obs?: string | null
          fms_score_total?: number | null
          foto_frontal_url?: string | null
          foto_lateral_url?: string | null
          foto_posterior_url?: string | null
          full_name: string
          goal: string
          has_trained_before?: boolean
          id?: string
          injury_history?: string
          notes?: string | null
          phone: string
          preferred_time: string
          reviewed_at?: string | null
          session_duration: string
          status?: string
          stopped_training_duration?: string | null
          student_id?: string | null
          submitted_at?: string
          teacher_id?: string | null
          updated_at?: string
          weight_kg: number
        }
        Update: {
          age?: number
          available_days_per_week?: number
          available_equipment?: string[]
          created_at?: string
          deep_squat_obs?: string | null
          deep_squat_score?: number | null
          deep_squat_video_frontal_url?: string | null
          deep_squat_video_lateral_url?: string | null
          deep_squat_video_posterior_url?: string | null
          email?: string
          experience_level?: string
          fms_hurdle_obs?: string | null
          fms_hurdle_step_direito?: number | null
          fms_hurdle_step_esquerdo?: number | null
          fms_lunge_direito?: number | null
          fms_lunge_esquerdo?: number | null
          fms_lunge_obs?: string | null
          fms_score_total?: number | null
          foto_frontal_url?: string | null
          foto_lateral_url?: string | null
          foto_posterior_url?: string | null
          full_name?: string
          goal?: string
          has_trained_before?: boolean
          id?: string
          injury_history?: string
          notes?: string | null
          phone?: string
          preferred_time?: string
          reviewed_at?: string | null
          session_duration?: string
          status?: string
          stopped_training_duration?: string | null
          student_id?: string | null
          submitted_at?: string
          teacher_id?: string | null
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "anamneses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamneses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          aluno_id: string | null
          anamnese_id: string | null
          aviso_vencimento_enviado_at: string | null
          created_at: string
          data_cancelamento: string | null
          data_inicio: string | null
          data_renovacao: string | null
          id: string
          metodo_pagamento: string | null
          moeda: string
          mp_external_reference: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          mp_raw_payment: Json | null
          notas: string | null
          payer_note: string | null
          payment_proof_approved_at: string | null
          payment_proof_status: string
          payment_proof_submitted_at: string | null
          payment_proof_url: string | null
          plano_id: string
          status: string
          teacher_id: string | null
          updated_at: string
          valor_cobrado: number | null
        }
        Insert: {
          aluno_id?: string | null
          anamnese_id?: string | null
          aviso_vencimento_enviado_at?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_inicio?: string | null
          data_renovacao?: string | null
          id?: string
          metodo_pagamento?: string | null
          moeda?: string
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_raw_payment?: Json | null
          notas?: string | null
          payer_note?: string | null
          payment_proof_approved_at?: string | null
          payment_proof_status?: string
          payment_proof_submitted_at?: string | null
          payment_proof_url?: string | null
          plano_id: string
          status?: string
          teacher_id?: string | null
          updated_at?: string
          valor_cobrado?: number | null
        }
        Update: {
          aluno_id?: string | null
          anamnese_id?: string | null
          aviso_vencimento_enviado_at?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_inicio?: string | null
          data_renovacao?: string | null
          id?: string
          metodo_pagamento?: string | null
          moeda?: string
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_raw_payment?: Json | null
          notas?: string | null
          payer_note?: string | null
          payment_proof_approved_at?: string | null
          payment_proof_status?: string
          payment_proof_submitted_at?: string | null
          payment_proof_url?: string | null
          plano_id?: string
          status?: string
          teacher_id?: string | null
          updated_at?: string
          valor_cobrado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_anamnese_id_fkey"
            columns: ["anamnese_id"]
            isOneToOne: false
            referencedRelation: "anamneses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_alert_reads: {
        Row: {
          alert_id: string
          created_at: string
          is_read: boolean
          teacher_id: string
          updated_at: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          is_read?: boolean
          teacher_id: string
          updated_at?: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          is_read?: boolean
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_alert_reads_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      cpf_trial_registry: {
        Row: {
          cpf_normalized: string
          created_at: string
          first_teacher_id: string | null
          first_user_id: string | null
          granted_subscription_id: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
        }
        Insert: {
          cpf_normalized: string
          created_at?: string
          first_teacher_id?: string | null
          first_user_id?: string | null
          granted_subscription_id?: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at?: string
        }
        Update: {
          cpf_normalized?: string
          created_at?: string
          first_teacher_id?: string | null
          first_user_id?: string | null
          granted_subscription_id?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cpf_trial_registry_first_teacher_id_fkey"
            columns: ["first_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cpf_trial_registry_granted_subscription_id_fkey"
            columns: ["granted_subscription_id"]
            isOneToOne: false
            referencedRelation: "teacher_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          body_region: string | null
          breathing_tips: string
          category: string
          common_mistakes: string
          contraindications: string
          created_at: string
          created_by: string | null
          description: string
          difficulty_level: string | null
          duration_limit_seconds: number | null
          equipment: string | null
          execution_instructions: string
          exercise_type: string | null
          id: string
          is_active: boolean
          is_global: boolean
          movement_type: string | null
          muscle_category: string | null
          muscle_group_primary: string | null
          muscle_groups_secondary: string[]
          name: string
          posture_tips: string
          slug: string
          thumbnail_storage_path: string | null
          thumbnail_url: string | null
          updated_at: string
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          body_region?: string | null
          breathing_tips?: string
          category: string
          common_mistakes?: string
          contraindications?: string
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty_level?: string | null
          duration_limit_seconds?: number | null
          equipment?: string | null
          execution_instructions?: string
          exercise_type?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          movement_type?: string | null
          muscle_category?: string | null
          muscle_group_primary?: string | null
          muscle_groups_secondary?: string[]
          name: string
          posture_tips?: string
          slug: string
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          body_region?: string | null
          breathing_tips?: string
          category?: string
          common_mistakes?: string
          contraindications?: string
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty_level?: string | null
          duration_limit_seconds?: number | null
          equipment?: string | null
          execution_instructions?: string
          exercise_type?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          movement_type?: string | null
          muscle_category?: string | null
          muscle_group_primary?: string | null
          muscle_groups_secondary?: string[]
          name?: string
          posture_tips?: string
          slug?: string
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          event_type: string
          id: string
          payload: Json
          provider: string
          received_at: string
        }
        Insert: {
          event_type: string
          id?: string
          payload?: Json
          provider: string
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          destaque: boolean
          features: Json
          id: string
          nome: string
          ordem: number
          periodo_dias: number
          preco: number
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          destaque?: boolean
          features?: Json
          id?: string
          nome: string
          ordem?: number
          periodo_dias?: number
          preco: number
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          destaque?: boolean
          features?: Json
          id?: string
          nome?: string
          ordem?: number
          periodo_dias?: number
          preco?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          notes: string | null
          phone: string | null
          platform_role: string
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          notes?: string | null
          phone?: string | null
          platform_role?: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          platform_role?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      student_check_ins: {
        Row: {
          block_label: string | null
          check_in_date: string
          checked_in_at: string
          created_at: string
          duration_minutes: number | null
          id: string
          notes: string | null
          source: string
          student_id: string
          teacher_id: string
          training_progress_mode: string | null
          training_structure_type: string | null
          workout_block_id: string | null
          workout_plan_id: string | null
        }
        Insert: {
          block_label?: string | null
          check_in_date?: string
          checked_in_at?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          source?: string
          student_id: string
          teacher_id: string
          training_progress_mode?: string | null
          training_structure_type?: string | null
          workout_block_id?: string | null
          workout_plan_id?: string | null
        }
        Update: {
          block_label?: string | null
          check_in_date?: string
          checked_in_at?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          source?: string
          student_id?: string
          teacher_id?: string
          training_progress_mode?: string | null
          training_structure_type?: string | null
          workout_block_id?: string | null
          workout_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_check_ins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_check_ins_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_check_ins_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "student_workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      student_workout_plans: {
        Row: {
          blocks: Json
          created_at: string
          current_suggested_block_id: string | null
          end_date: string | null
          id: string
          is_active: boolean
          last_completed_at: string | null
          last_completed_block_id: string | null
          next_workout_change_date: string | null
          plan_name: string
          source_workout_template_id: string | null
          start_date: string
          student_id: string
          teacher_id: string
          training_progress_mode: string
          training_structure_type: string
          updated_at: string
          weekly_goal: number
        }
        Insert: {
          blocks?: Json
          created_at?: string
          current_suggested_block_id?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          last_completed_at?: string | null
          last_completed_block_id?: string | null
          next_workout_change_date?: string | null
          plan_name?: string
          source_workout_template_id?: string | null
          start_date: string
          student_id: string
          teacher_id: string
          training_progress_mode?: string
          training_structure_type?: string
          updated_at?: string
          weekly_goal?: number
        }
        Update: {
          blocks?: Json
          created_at?: string
          current_suggested_block_id?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          last_completed_at?: string | null
          last_completed_block_id?: string | null
          next_workout_change_date?: string | null
          plan_name?: string
          source_workout_template_id?: string | null
          start_date?: string
          student_id?: string
          teacher_id?: string
          training_progress_mode?: string
          training_structure_type?: string
          updated_at?: string
          weekly_goal?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_workout_plans_source_workout_template_id_fkey"
            columns: ["source_workout_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_workout_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_workout_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          access_status: string
          auth_user_id: string | null
          birth_date: string | null
          created_at: string
          email: string
          first_access_completed_at: string | null
          full_name: string
          goal: string
          id: string
          last_check_in_at: string | null
          last_login_at: string | null
          metadata: Json
          must_change_password: boolean
          next_workout_change: string | null
          notes: string | null
          payment_due_date: string | null
          payment_last_paid_at: string | null
          phone: string | null
          profile_photo_storage_key: string | null
          profile_photo_url: string | null
          proof_of_payment_file_name: string | null
          proof_of_payment_file_url: string | null
          proof_of_payment_mime_type: string | null
          proof_of_payment_sent_at: string | null
          proof_of_payment_status: string
          proof_of_payment_storage_key: string | null
          start_date: string
          status: string
          teacher_id: string
          temporary_password_generated_at: string | null
          updated_at: string
          workout_updated_at: string | null
        }
        Insert: {
          access_status?: string
          auth_user_id?: string | null
          birth_date?: string | null
          created_at?: string
          email: string
          first_access_completed_at?: string | null
          full_name: string
          goal?: string
          id?: string
          last_check_in_at?: string | null
          last_login_at?: string | null
          metadata?: Json
          must_change_password?: boolean
          next_workout_change?: string | null
          notes?: string | null
          payment_due_date?: string | null
          payment_last_paid_at?: string | null
          phone?: string | null
          profile_photo_storage_key?: string | null
          profile_photo_url?: string | null
          proof_of_payment_file_name?: string | null
          proof_of_payment_file_url?: string | null
          proof_of_payment_mime_type?: string | null
          proof_of_payment_sent_at?: string | null
          proof_of_payment_status?: string
          proof_of_payment_storage_key?: string | null
          start_date?: string
          status?: string
          teacher_id: string
          temporary_password_generated_at?: string | null
          updated_at?: string
          workout_updated_at?: string | null
        }
        Update: {
          access_status?: string
          auth_user_id?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string
          first_access_completed_at?: string | null
          full_name?: string
          goal?: string
          id?: string
          last_check_in_at?: string | null
          last_login_at?: string | null
          metadata?: Json
          must_change_password?: boolean
          next_workout_change?: string | null
          notes?: string | null
          payment_due_date?: string | null
          payment_last_paid_at?: string | null
          phone?: string | null
          profile_photo_storage_key?: string | null
          profile_photo_url?: string | null
          proof_of_payment_file_name?: string | null
          proof_of_payment_file_url?: string | null
          proof_of_payment_mime_type?: string | null
          proof_of_payment_sent_at?: string | null
          proof_of_payment_status?: string
          proof_of_payment_storage_key?: string | null
          start_date?: string
          status?: string
          teacher_id?: string
          temporary_password_generated_at?: string | null
          updated_at?: string
          workout_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subscriptions: {
        Row: {
          access_blocked: boolean
          billing_provider: string | null
          blocked_reason: string | null
          canceled_at: string | null
          created_at: string
          current_period_ends_at: string | null
          current_period_starts_at: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json
          plan_type: string
          started_at: string
          status: string
          student_limit: number | null
          teacher_id: string
          trial_ends_at: string | null
          trial_granted: boolean
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          access_blocked?: boolean
          billing_provider?: string | null
          blocked_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json
          plan_type: string
          started_at?: string
          status: string
          student_limit?: number | null
          teacher_id: string
          trial_ends_at?: string | null
          trial_granted?: boolean
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          access_blocked?: boolean
          billing_provider?: string | null
          blocked_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json
          plan_type?: string
          started_at?: string
          status?: string
          student_limit?: number | null
          teacher_id?: string
          trial_ends_at?: string | null
          trial_granted?: boolean
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subscriptions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          monthly_fee: number | null
          onboarding_completed: boolean
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          monthly_fee?: number | null
          onboarding_completed?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          monthly_fee?: number | null
          onboarding_completed?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          name: string
          notes: string
          objective: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          name: string
          notes?: string
          objective?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          name?: string
          notes?: string
          objective?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_student_can_check_in: {
        Args: {
          p_check_in_date: string
          p_student_id: string
          p_teacher_id: string
        }
        Returns: undefined
      }
      assert_teacher_can_add_student: {
        Args: { p_teacher_id: string }
        Returns: undefined
      }
      confirm_mock_pro_payment: {
        Args: { p_current_period_ends_at?: string; p_teacher_id?: string }
        Returns: {
          access_blocked: boolean
          billing_provider: string | null
          blocked_reason: string | null
          canceled_at: string | null
          created_at: string
          current_period_ends_at: string | null
          current_period_starts_at: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json
          plan_type: string
          started_at: string
          status: string
          student_limit: number | null
          teacher_id: string
          trial_ends_at: string | null
          trial_granted: boolean
          trial_started_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_initial_teacher_plan: {
        Args: { p_cpf: string; p_origin?: string; p_teacher_id: string }
        Returns: {
          access_blocked: boolean
          billing_provider: string | null
          blocked_reason: string | null
          canceled_at: string | null
          created_at: string
          current_period_ends_at: string | null
          current_period_starts_at: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json
          plan_type: string
          started_at: string
          status: string
          student_limit: number | null
          teacher_id: string
          trial_ends_at: string | null
          trial_granted: boolean
          trial_started_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_teacher_subscription_from_selection: {
        Args: {
          p_cpf: string
          p_mock_payment_confirmed?: boolean
          p_origin?: string
          p_selected_plan: string
          p_teacher_id: string
        }
        Returns: {
          access_blocked: boolean
          billing_provider: string | null
          blocked_reason: string | null
          canceled_at: string | null
          created_at: string
          current_period_ends_at: string | null
          current_period_starts_at: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json
          plan_type: string
          started_at: string
          status: string
          student_limit: number | null
          teacher_id: string
          trial_ends_at: string | null
          trial_granted: boolean
          trial_started_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_student_id: { Args: never; Returns: string }
      current_student_teacher_id: { Args: never; Returns: string }
      current_teacher_id: { Args: never; Returns: string }
      ensure_student_workout_plan: {
        Args: {
          p_next_workout_change_date?: string
          p_start_date: string
          p_student_id: string
          p_teacher_id: string
        }
        Returns: {
          blocks: Json
          created_at: string
          current_suggested_block_id: string | null
          end_date: string | null
          id: string
          is_active: boolean
          last_completed_at: string | null
          last_completed_block_id: string | null
          next_workout_change_date: string | null
          plan_name: string
          source_workout_template_id: string | null
          start_date: string
          student_id: string
          teacher_id: string
          training_progress_mode: string
          training_structure_type: string
          updated_at: string
          weekly_goal: number
        }
        SetofOptions: {
          from: "*"
          to: "student_workout_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_teacher_access_snapshot: {
        Args: { teacher_uuid: string }
        Returns: {
          access_message: string
          can_add_student: boolean
          current_period_ends_at: string
          current_student_count: number
          effective_status: string
          has_active_access: boolean
          plan_type: string
          stored_status: string
          student_limit: number
          subscription_id: string
          teacher_id: string
          trial_active: boolean
          trial_ends_at: string
        }[]
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_valid_cpf: { Args: { value: string }; Returns: boolean }
      mark_student_first_access_complete: {
        Args: { p_student_id: string }
        Returns: {
          access_status: string
          auth_user_id: string | null
          birth_date: string | null
          created_at: string
          email: string
          first_access_completed_at: string | null
          full_name: string
          goal: string
          id: string
          last_check_in_at: string | null
          last_login_at: string | null
          metadata: Json
          must_change_password: boolean
          next_workout_change: string | null
          notes: string | null
          payment_due_date: string | null
          payment_last_paid_at: string | null
          phone: string | null
          profile_photo_storage_key: string | null
          profile_photo_url: string | null
          proof_of_payment_file_name: string | null
          proof_of_payment_file_url: string | null
          proof_of_payment_mime_type: string | null
          proof_of_payment_sent_at: string | null
          proof_of_payment_status: string
          proof_of_payment_storage_key: string | null
          start_date: string
          status: string
          teacher_id: string
          temporary_password_generated_at: string | null
          updated_at: string
          workout_updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "students"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      normalize_cpf: { Args: { value: string }; Returns: string }
      provision_current_teacher_account: {
        Args: {
          p_mock_pro_payment_confirmed?: boolean
          p_selected_plan?: string
        }
        Returns: {
          access_message: string
          can_add_student: boolean
          current_period_ends_at: string
          current_student_count: number
          effective_status: string
          has_active_access: boolean
          plan_type: string
          stored_status: string
          student_limit: number
          subscription_id: string
          teacher_id: string
          trial_active: boolean
          trial_ends_at: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      student_workout_access_blocked: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      submit_student_payment_proof: {
        Args: {
          p_file_name: string
          p_file_url: string
          p_mime_type: string
          p_sent_at?: string
          p_storage_key: string
          p_student_id: string
        }
        Returns: {
          access_status: string
          auth_user_id: string | null
          birth_date: string | null
          created_at: string
          email: string
          first_access_completed_at: string | null
          full_name: string
          goal: string
          id: string
          last_check_in_at: string | null
          last_login_at: string | null
          metadata: Json
          must_change_password: boolean
          next_workout_change: string | null
          notes: string | null
          payment_due_date: string | null
          payment_last_paid_at: string | null
          phone: string | null
          profile_photo_storage_key: string | null
          profile_photo_url: string | null
          proof_of_payment_file_name: string | null
          proof_of_payment_file_url: string | null
          proof_of_payment_mime_type: string | null
          proof_of_payment_sent_at: string | null
          proof_of_payment_status: string
          proof_of_payment_storage_key: string | null
          start_date: string
          status: string
          teacher_id: string
          temporary_password_generated_at: string | null
          updated_at: string
          workout_updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "students"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_can_add_student: {
        Args: { teacher_uuid: string }
        Returns: boolean
      }
      teacher_has_active_access: {
        Args: { teacher_uuid: string }
        Returns: boolean
      }
      touch_student_last_login: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      update_student_exercise_load: {
        Args: {
          p_block_id: string
          p_exercise_id: string
          p_student_id: string
          p_student_load: string
        }
        Returns: {
          blocks: Json
          created_at: string
          current_suggested_block_id: string | null
          end_date: string | null
          id: string
          is_active: boolean
          last_completed_at: string | null
          last_completed_block_id: string | null
          next_workout_change_date: string | null
          plan_name: string
          source_workout_template_id: string | null
          start_date: string
          student_id: string
          teacher_id: string
          training_progress_mode: string
          training_structure_type: string
          updated_at: string
          weekly_goal: number
        }
        SetofOptions: {
          from: "*"
          to: "student_workout_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
