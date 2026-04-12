import { z } from "zod";
import { isValidPhone, normalizeEmail, normalizePhone, sanitizeName } from "@/lib/auth-validators";
import type { StudentAccessStatus } from "@/types";

export const studentFormSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo do aluno.").transform(sanitizeName),
  email: z.string().trim().min(1, "Informe o e-mail do aluno.").email("Informe um e-mail valido.").transform(normalizeEmail),
  phone: z.string().optional().nullable(),
  birthDate: z.string().min(1, "Informe a data de nascimento."),
  goal: z.string().trim().min(2, "Informe o objetivo principal do aluno."),
  notes: z.string().max(500, "As observacoes devem ter no maximo 500 caracteres.").optional().nullable(),
}).superRefine((data, ctx) => {
  if (!isValidPhone(data.phone)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Informe um telefone valido com DDD." });
  }
});

export function normalizeStudentPayload(data: z.infer<typeof studentFormSchema>) {
  return {
    fullName: data.fullName,
    email: normalizeEmail(data.email),
    phone: data.phone ? normalizePhone(data.phone) : "",
    birthDate: data.birthDate,
    goal: data.goal.trim(),
    notes: data.notes?.trim() ?? "",
  };
}

export function getStudentAccessStatusLabel(status: StudentAccessStatus) {
  switch (status) {
    case "pre_registered":
      return "Sem acesso";
    case "temporary_password_pending":
      return "Primeiro acesso pendente";
    case "active":
      return "Conta ativa";
    case "inactive":
      return "Inativo";
    default:
      return status;
  }
}

export function getStudentAccessTone(status: StudentAccessStatus) {
  switch (status) {
    case "pre_registered":
      return "bg-muted text-muted-foreground";
    case "temporary_password_pending":
      return "bg-warning/15 text-warning";
    case "active":
      return "bg-success/15 text-success";
    case "inactive":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}
