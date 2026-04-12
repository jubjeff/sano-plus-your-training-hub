import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { TeacherPlanType } from "@/types/auth";
import type { TeacherAccessSnapshot } from "@/types/supabase-plans";

const teacherAccountSchema = z.object({
  fullName: z.string().trim().min(3),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cpf: z.string().min(11),
  phone: z.string().trim().optional().nullable(),
  selectedPlan: z.enum(["basic", "pro"]),
  mockProPaymentConfirmed: z.boolean().optional(),
});

export type TeacherAccessViewState = {
  isBlocked: boolean;
  isTrialing: boolean;
  isPro: boolean;
  canAddStudent: boolean;
  statusLabel: string;
  bannerMessage: string;
};

function extractErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const nested = (error as { message?: string }).message;
    if (nested) return nested;
  }

  return fallback;
}

function normalizeSnapshotPayload(data: unknown) {
  return Array.isArray(data) ? data[0] : data;
}

async function resolveOwnTeacherId() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Professor nao encontrado.");
  }

  return data.id as string;
}

export async function registerTeacherWithTrial(input: {
  email: string;
  password: string;
  fullName: string;
  birthDate: string;
  cpf: string;
  phone?: string | null;
  selectedPlan: TeacherPlanType;
  mockProPaymentConfirmed?: boolean;
}) {
  const supabase = getSupabaseClient();
  const payload = teacherAccountSchema.parse(input);

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: payload.fullName,
        birth_date: payload.birthDate,
        cpf: payload.cpf,
        phone: payload.phone ?? null,
        selected_plan: payload.selectedPlan,
        mock_pro_payment_confirmed: Boolean(payload.mockProPaymentConfirmed),
      },
    },
  });

  if (signUpError) {
    throw new Error(signUpError.message);
  }

  if (!signUpData.session) {
    return {
      requiresEmailConfirmation: true as const,
    };
  }

  const { data, error } = await supabase.functions.invoke("create-teacher-account", {
    body: payload,
  });

  if (error) {
    throw new Error(extractErrorMessage(error, "Nao foi possivel provisionar a conta do professor."));
  }

  return data as {
    teacher: { userId: string; email: string; teacherId: string };
    subscription: TeacherAccessSnapshot;
  };
}

export async function confirmMockProPayment(input: {
  teacherId?: string | null;
  accessRequestId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseClient();
  const currentPeriodEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase.functions.invoke("confirm-mock-pro-payment", {
      body: {
        teacherId: input.teacherId ?? null,
        currentPeriodEndsAt,
        accessRequestId: input.accessRequestId ?? null,
        metadata: input.metadata ?? {},
      },
    });

    if (error) {
      throw error;
    }

    return data as {
      subscription: {
        id: string;
        plan_type: "pro";
        status: "active";
      };
      message: string;
    };
  } catch {
    const teacherId = input.teacherId ?? await resolveOwnTeacherId();
    const { data, error } = await supabase.rpc("confirm_mock_pro_payment", {
      p_teacher_id: teacherId,
      p_current_period_ends_at: currentPeriodEndsAt,
      p_access_request_id: input.accessRequestId ?? null,
      p_metadata: input.metadata ?? {},
    });

    if (error) {
      throw new Error(extractErrorMessage(error, "Nao foi possivel confirmar o pagamento simulado do Pro."));
    }

    return {
      subscription: data as {
        id: string;
        plan_type: "pro";
        status: "active";
      },
      message: "Pagamento simulado com sucesso.",
    };
  }
}

export async function fetchTeacherAccessStatus() {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase.functions.invoke("get-teacher-access-status", {
      method: "GET",
    });

    if (error) {
      throw error;
    }

    return data as {
      teacherId: string;
      access: TeacherAccessSnapshot;
      message: string;
    };
  } catch {
    const teacherId = await resolveOwnTeacherId();
    const { data, error } = await supabase.rpc("get_teacher_access_snapshot", {
      teacher_uuid: teacherId,
    });

    if (error) {
      throw new Error(extractErrorMessage(error, "Nao foi possivel consultar o status de acesso."));
    }

    const snapshot = normalizeSnapshotPayload(data) as TeacherAccessSnapshot;
    return {
      teacherId,
      access: snapshot,
      message: snapshot?.access_message ?? "Acesso consultado com sucesso.",
    };
  }
}

export async function addStudentForTeacher(input: {
  teacherId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  notes?: string | null;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .insert({
      teacher_id: input.teacherId,
      full_name: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      birth_date: input.birthDate ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("plano Basic permite apenas 1 aluno")) {
      throw new Error("O plano Basic permite apenas 1 aluno. Faca upgrade para o Pro para adicionar alunos ilimitados.");
    }

    if (error.message.includes("teste expirou")) {
      throw new Error("Seu periodo de teste expirou. Faca upgrade para o plano Pro para continuar.");
    }

    throw new Error(error.message);
  }

  return data;
}

export async function requestTeacherProUpgrade(input: {
  message?: string | null;
  amountCents?: number | null;
  currency?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase.functions.invoke("request-pro-upgrade", {
      body: {
        message: input.message ?? null,
        amountCents: input.amountCents ?? null,
        currency: input.currency ?? "BRL",
        metadata: input.metadata ?? {},
      },
    });

    if (error) {
      throw error;
    }

    return data as {
      request: {
        id: string;
        status: string;
        requested_plan_type: string;
      };
      message: string;
    };
  } catch {
    const teacherId = await resolveOwnTeacherId();
    const { data, error } = await supabase.rpc("request_pro_upgrade", {
      p_teacher_id: teacherId,
      p_message: input.message ?? null,
      p_amount_cents: input.amountCents ?? null,
      p_currency: input.currency ?? "BRL",
      p_metadata: input.metadata ?? {},
    });

    if (error) {
      throw new Error(extractErrorMessage(error, "Nao foi possivel solicitar o upgrade para Pro."));
    }

    return {
      request: data as {
        id: string;
        status: string;
        requested_plan_type: string;
      },
      message: "Solicitacao de upgrade registrada com sucesso.",
    };
  }
}

export function buildTeacherAccessViewState(snapshot: TeacherAccessSnapshot): TeacherAccessViewState {
  return {
    isBlocked: !snapshot.has_active_access,
    isTrialing: snapshot.effective_status === "trialing",
    isPro: snapshot.plan_type === "pro" && snapshot.effective_status === "active",
    canAddStudent: snapshot.can_add_student,
    statusLabel: `${snapshot.plan_type.toUpperCase()} • ${snapshot.effective_status}`,
    bannerMessage: snapshot.access_message,
  };
}
