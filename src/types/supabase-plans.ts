export type TeacherPlanType = "basic" | "pro";
export type TeacherSubscriptionStatus = "trialing" | "active" | "expired" | "blocked" | "pending_payment" | "canceled";

export interface TeacherAccessSnapshot {
  teacher_id: string;
  subscription_id: string | null;
  plan_type: TeacherPlanType;
  stored_status: TeacherSubscriptionStatus;
  effective_status: TeacherSubscriptionStatus;
  trial_active: boolean;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  has_active_access: boolean;
  student_limit: number | null;
  current_student_count: number;
  can_add_student: boolean;
  access_message: string;
}
