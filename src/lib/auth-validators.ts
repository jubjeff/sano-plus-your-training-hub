import { z } from "zod";

const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9]/;

export function sanitizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string) {
  const digits = normalizeCpf(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calculateCheckDigit = (base: string, factor: number) => {
    const sum = base
      .split("")
      .reduce((acc, digit) => acc + Number(digit) * factor--, 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const digitOne = calculateCheckDigit(cpf.slice(0, 9), 10);
  const digitTwo = calculateCheckDigit(cpf.slice(0, 10), 11);
  return digitOne === Number(cpf[9]) && digitTwo === Number(cpf[10]);
}

export function isAdult(birthDate: string) {
  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  const dayDiff = today.getDate() - date.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 18;
}

export function isValidPhone(value?: string | null) {
  if (!value) return true;
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11;
}

export function validateStrongPassword(value: string) {
  return {
    minLength: value.length >= 8,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /\d/.test(value),
    special: SPECIAL_CHARACTER_REGEX.test(value),
  };
}

export function getPasswordStrength(value: string) {
  const checks = validateStrongPassword(value);
  const score = Object.values(checks).filter(Boolean).length;

  if (score <= 2) return { score, label: "Fraca" };
  if (score === 3 || score === 4) return { score, label: "Media" };
  return { score, label: "Forte" };
}

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail valido.").transform(normalizeEmail),
  password: z.string().min(1, "Informe sua senha."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail valido.").transform(normalizeEmail),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .superRefine((data, ctx) => {
    const checks = validateStrongPassword(data.password);
    if (!checks.uppercase) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "A senha precisa de ao menos 1 letra maiuscula." });
    if (!checks.lowercase) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "A senha precisa de ao menos 1 letra minuscula." });
    if (!checks.number) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "A senha precisa de ao menos 1 numero." });
    if (!checks.special) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "A senha precisa de ao menos 1 caractere especial." });
    if (data.password !== data.confirmPassword) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "As senhas precisam ser iguais." });
  });

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe seu nome completo.").transform(sanitizeName),
    birthDate: z.string().min(1, "Informe sua data de nascimento."),
    cpf: z.string().min(1, "Informe seu CPF.").transform(normalizeCpf),
    email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail valido.").transform(normalizeEmail),
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .superRefine((data, ctx) => {
    if (!isAdult(data.birthDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["birthDate"], message: "E preciso ter pelo menos 18 anos." });
    }

    if (!isValidCpf(data.cpf)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cpf"], message: "Informe um CPF valido." });
    }

    const checks = validateStrongPassword(data.password);
    if (!checks.uppercase) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "A senha precisa de ao menos 1 letra maiuscula." });
    if (!checks.lowercase) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "A senha precisa de ao menos 1 letra minuscula." });
    if (!checks.number) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "A senha precisa de ao menos 1 numero." });
    if (!checks.special) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "A senha precisa de ao menos 1 caractere especial." });
    if (data.password !== data.confirmPassword) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "As senhas precisam ser iguais." });
  });

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe seu nome completo.").transform(sanitizeName),
    birthDate: z.string().min(1, "Informe sua data de nascimento."),
    phone: z.string().optional().nullable(),
    notes: z.string().max(400, "As observacoes devem ter no maximo 400 caracteres.").optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!isAdult(data.birthDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["birthDate"], message: "E preciso ter pelo menos 18 anos." });
    }

    if (!isValidPhone(data.phone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Informe um telefone valido com DDD." });
    }
  });

export function mapZodErrors(error: z.ZodError) {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const key = String(issue.path[0] ?? "form");
    if (!acc[key]) acc[key] = issue.message;
    return acc;
  }, {});
}
