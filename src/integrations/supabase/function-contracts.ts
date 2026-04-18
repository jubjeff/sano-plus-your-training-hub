export const EDGE_FUNCTION_NAMES = {
  teacherAdminActions: "teacher-admin-actions",
  automationDispatch: "automation-dispatch",
  integrationWebhook: "integration-webhook",
  secureOps: "secure-ops",
} as const;

export type EdgeFunctionName = (typeof EDGE_FUNCTION_NAMES)[keyof typeof EDGE_FUNCTION_NAMES];
export type EdgeFunctionExposure = "browser-authenticated" | "internal-secret" | "public-webhook";
export type EdgeFunctionCategory = "teacher-admin" | "automation" | "integration" | "secure-ops";

export interface EdgeFunctionCatalogItem {
  name: EdgeFunctionName;
  category: EdgeFunctionCategory;
  exposure: EdgeFunctionExposure;
  summary: string;
  recommendedUses: string[];
}

export const EDGE_FUNCTION_CATALOG: EdgeFunctionCatalogItem[] = [
  {
    name: EDGE_FUNCTION_NAMES.teacherAdminActions,
    category: "teacher-admin",
    exposure: "browser-authenticated",
    summary: "Acoes administrativas do professor que exigem validacao centralizada e auditoria.",
    recommendedUses: [
      "Emitir ou resetar acesso temporario do aluno",
      "Confirmar recebimento de pagamento com regras de permissao",
      "Acionar mudancas de ciclo do aluno com validacoes server-side",
    ],
  },
  {
    name: EDGE_FUNCTION_NAMES.automationDispatch,
    category: "automation",
    exposure: "internal-secret",
    summary: "Disparo de rotinas agendadas, reconciliacoes e tarefas internas nao expostas ao cliente.",
    recommendedUses: [
      "Escanear inadimplencia e bloqueios",
      "Gerar alertas automaticos de engajamento",
      "Sincronizar snapshots e processos batch curtos",
    ],
  },
  {
    name: EDGE_FUNCTION_NAMES.integrationWebhook,
    category: "integration",
    exposure: "public-webhook",
    summary: "Recebimento de webhooks de pagamentos, mensagens e integracoes externas.",
    recommendedUses: [
      "Pagamentos e confirmacoes assincronas",
      "Recebimento de eventos de terceiros",
      "Fan-out para atualizacoes internas seguras",
    ],
  },
  {
    name: EDGE_FUNCTION_NAMES.secureOps,
    category: "secure-ops",
    exposure: "internal-secret",
    summary: "Operacoes privilegiadas que exigem service role e nao devem morar no browser.",
    recommendedUses: [
      "Provisionamento de contas",
      "Mutacoes administrativas sensiveis",
      "Integracoes servidor-servidor com segredos",
    ],
  },
];

export type TeacherAdminAction =
  | "create_student_with_temporary_password"
  | "reset_student_temporary_access"
  | "set_student_status"
  | "mark_payment_received"
  | "approve_payment_proof"
  | "activate_coach_pro_plan";

export interface StudentTemporaryAccessResult {
  studentId: string;
  studentName: string;
  email: string;
  temporaryPassword: string;
  generatedAt: string;
  emailDelivery?: {
    status: "sent" | "skipped";
    provider: "resend" | "none";
    message: string;
  };
}

export interface CreateStudentWithTemporaryPasswordPayload {
  fullName: string;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  goal?: string | null;
  notes?: string | null;
  startDate: string;
}

export interface TeacherAdminActionPayloadMap {
  create_student_with_temporary_password: CreateStudentWithTemporaryPasswordPayload;
  reset_student_temporary_access: {
    studentId: string;
  };
  set_student_status: {
    studentId: string;
    active: boolean;
  };
  mark_payment_received: {
    studentId: string;
    paidAt?: string | null;
  };
  approve_payment_proof: {
    studentId: string;
    approvedAt?: string | null;
  };
  activate_coach_pro_plan: {
    coachId?: string | null;
    source?: "manual" | "payment_confirmation";
  };
}

export type TeacherAdminActionPayload<TAction extends TeacherAdminAction> = TeacherAdminActionPayloadMap[TAction];

export interface TeacherAdminActionRequest<TAction extends TeacherAdminAction = TeacherAdminAction> {
  action: TAction;
  payload: TeacherAdminActionPayload<TAction>;
}

export interface EdgeFunctionSuccessEnvelope<TData = unknown> {
  ok: true;
  requestId: string;
  data: TData;
}

export interface EdgeFunctionErrorEnvelope {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type EdgeFunctionEnvelope<TData = unknown> = EdgeFunctionSuccessEnvelope<TData> | EdgeFunctionErrorEnvelope;
