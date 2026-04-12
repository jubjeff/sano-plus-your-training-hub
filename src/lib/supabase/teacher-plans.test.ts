import { describe, expect, it } from "vitest";
import { buildTeacherAccessViewState } from "@/lib/supabase/teacher-plans";
import type { TeacherAccessSnapshot } from "@/types/supabase-plans";

function buildSnapshot(overrides: Partial<TeacherAccessSnapshot> = {}): TeacherAccessSnapshot {
  return {
    teacher_id: "teacher-1",
    subscription_id: "sub-1",
    plan_type: "basic",
    stored_status: "trialing",
    effective_status: "trialing",
    trial_active: true,
    trial_ends_at: "2026-05-01T00:00:00Z",
    current_period_ends_at: null,
    has_active_access: true,
    student_limit: 1,
    current_student_count: 0,
    can_add_student: true,
    access_message: "Seu trial Basic esta ativo ate 2026-05-01T00:00:00Z.",
    ...overrides,
  };
}

describe("buildTeacherAccessViewState", () => {
  it("marks trialing accounts correctly", () => {
    const view = buildTeacherAccessViewState(buildSnapshot());
    expect(view.isTrialing).toBe(true);
    expect(view.isBlocked).toBe(false);
    expect(view.canAddStudent).toBe(true);
  });

  it("marks expired accounts as blocked", () => {
    const view = buildTeacherAccessViewState(
      buildSnapshot({
        effective_status: "expired",
        has_active_access: false,
        can_add_student: false,
        access_message: "Seu periodo de teste expirou. Faca upgrade para o plano Pro para continuar.",
      }),
    );

    expect(view.isBlocked).toBe(true);
    expect(view.bannerMessage).toContain("teste expirou");
  });

  it("marks pro accounts as active", () => {
    const view = buildTeacherAccessViewState(
      buildSnapshot({
        plan_type: "pro",
        stored_status: "active",
        effective_status: "active",
        trial_active: false,
        has_active_access: true,
        student_limit: null,
        can_add_student: true,
        access_message: "Plano Pro ativo.",
      }),
    );

    expect(view.isPro).toBe(true);
    expect(view.isBlocked).toBe(false);
  });
});
