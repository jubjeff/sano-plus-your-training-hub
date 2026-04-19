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
    `Senha provisoria: ${payload.temporaryPassword}`,
    "Observacao: No primeiro acesso, sera necessario criar uma nova senha.",
  ].join("\n");
}

export function buildStudentAccessWhatsappMessage(payload: StudentTemporaryAccessPayload) {
  return [
    `Ola, ${payload.studentName}. Seu acesso ao Sano+ foi criado.`,
    "",
    `Link: ${payload.accessLink}`,
    `E-mail: ${payload.email}`,
    `Senha provisoria: ${payload.temporaryPassword}`,
    "",
    "No primeiro acesso, voce precisara criar uma nova senha antes de entrar no sistema.",
  ].join("\n");
}

export function buildStudentAccessWhatsappUrl(payload: StudentTemporaryAccessPayload) {
  const message = buildStudentAccessWhatsappMessage(payload);
  const phone = normalizeWhatsappPhone(payload.phone);
  const url = phone ? new URL(`https://wa.me/${phone}`) : new URL("https://wa.me/");
  url.searchParams.set("text", message);
  return url.toString();
}
