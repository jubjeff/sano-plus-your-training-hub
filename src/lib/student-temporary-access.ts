type StudentTemporaryAccessPayload = {
  studentName: string;
  email: string;
  temporaryPassword: string;
  accessLink: string;
  phone?: string | null;
};

function normalizeWhatsappPhone(phone?: string | null) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function buildStudentAccessCopyText(payload: StudentTemporaryAccessPayload) {
  return [
    `Nome: ${payload.studentName}`,
    `Link: ${payload.accessLink}`,
    `E-mail: ${payload.email}`,
    `Senha provisória: ${payload.temporaryPassword}`,
    "Observação: no primeiro acesso, será necessário criar uma nova senha.",
  ].join("\n");
}

export function buildStudentAccessWhatsappMessage(payload: StudentTemporaryAccessPayload) {
  return [
    `Olá, ${payload.studentName}. Seu acesso ao Sano+ foi criado.`,
    "",
    `Link: ${payload.accessLink}`,
    `E-mail: ${payload.email}`,
    `Senha provisória: ${payload.temporaryPassword}`,
    "",
    "No primeiro acesso, você precisará criar uma nova senha antes de entrar no sistema.",
  ].join("\n");
}

export function buildStudentAccessWhatsappUrl(payload: StudentTemporaryAccessPayload) {
  const message = buildStudentAccessWhatsappMessage(payload);
  const phone = normalizeWhatsappPhone(payload.phone);
  const url = phone ? new URL(`https://wa.me/${phone}`) : new URL("https://wa.me/");
  url.searchParams.set("text", message);
  return url.toString();
}
