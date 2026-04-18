import {
  EDGE_FUNCTION_NAMES,
  type CreateStudentWithTemporaryPasswordPayload,
  type EdgeFunctionEnvelope,
  type StudentTemporaryAccessResult,
  type TeacherAdminAction,
  type TeacherAdminActionPayload,
  type TeacherAdminActionRequest,
} from "@/integrations/supabase/function-contracts";
import { invokeSupabaseEdgeFunction } from "@/integrations/supabase/functions";

export const teacherAdminActionsService = {
  async execute<TAction extends TeacherAdminAction>(
    action: TAction,
    payload: TeacherAdminActionPayload<TAction>,
  ): Promise<EdgeFunctionEnvelope<{ action: TAction }>> {
    return invokeSupabaseEdgeFunction<EdgeFunctionEnvelope<{ action: TAction }>, TeacherAdminActionRequest<TAction>>(
      EDGE_FUNCTION_NAMES.teacherAdminActions,
      {
        body: { action, payload },
      },
    );
  },

  async createStudentWithTemporaryPassword(payload: CreateStudentWithTemporaryPasswordPayload) {
    const response = await invokeSupabaseEdgeFunction<
      { ok: true; requestId: string; data: { result: StudentTemporaryAccessResult } },
      TeacherAdminActionRequest<"create_student_with_temporary_password">
    >(EDGE_FUNCTION_NAMES.teacherAdminActions, {
      body: {
        action: "create_student_with_temporary_password",
        payload,
      },
    });

    return response.data.result;
  },

  async resetStudentTemporaryAccess(studentId: string) {
    const response = await invokeSupabaseEdgeFunction<
      { ok: true; requestId: string; data: { result: StudentTemporaryAccessResult } },
      TeacherAdminActionRequest<"reset_student_temporary_access">
    >(EDGE_FUNCTION_NAMES.teacherAdminActions, {
      body: {
        action: "reset_student_temporary_access",
        payload: { studentId },
      },
    });

    return response.data.result;
  },

  async setStudentStatus(studentId: string, active: boolean) {
    const response = await invokeSupabaseEdgeFunction<
      { ok: true; requestId: string; data: { result: { id: string; status: string; access_status: string } } },
      TeacherAdminActionRequest<"set_student_status">
    >(EDGE_FUNCTION_NAMES.teacherAdminActions, {
      body: {
        action: "set_student_status",
        payload: { studentId, active },
      },
    });

    return response.data.result;
  },
};
