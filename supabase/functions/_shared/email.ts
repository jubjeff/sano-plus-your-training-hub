import { getEdgeRuntimeEnv } from "./env.ts";
import { EdgeHttpError } from "./http.ts";

type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailDeliveryResult = {
  status: "sent" | "skipped";
  provider: "resend" | "none";
  message: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendWithResend(input: SendTransactionalEmailInput): Promise<EmailDeliveryResult> {
  const env = getEdgeRuntimeEnv();
  if (!env.resendApiKey || !env.resendFromEmail) {
    return {
      status: "skipped",
      provider: "none",
      message: "Envio de e-mail nao configurado no ambiente.",
    };
  }

  const from = env.resendFromName ? `${env.resendFromName} <${env.resendFromEmail}>` : env.resendFromEmail;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new EdgeHttpError(
      "student_access_email_failed",
      "A conta do aluno foi criada, mas o envio do e-mail com a senha provisoria falhou.",
      502,
      {
        provider: "resend",
        responseStatus: response.status,
        responseBody: raw || null,
      },
    );
  }

  return {
    status: "sent",
    provider: "resend",
    message: "Senha provisoria enviada para o e-mail do aluno.",
  };
}

export async function sendStudentTemporaryAccessEmail(params: {
  studentName: string;
  email: string;
  temporaryPassword: string;
}) {
  const safeStudentName = escapeHtml(params.studentName);
  const safeEmail = escapeHtml(params.email);
  const safePassword = escapeHtml(params.temporaryPassword);

  return sendWithResend({
    to: params.email,
    subject: "Seu acesso inicial ao Sano+",
    text:
      `Ola, ${params.studentName}.\n\n` +
      `Seu acesso inicial ao Sano+ foi criado.\n` +
      `E-mail: ${params.email}\n` +
      `Senha provisoria: ${params.temporaryPassword}\n\n` +
      `No primeiro acesso, sera obrigatorio criar uma nova senha.\n`,
    html:
      `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">` +
      `<h2 style="margin-bottom:16px">Seu acesso inicial ao Sano+</h2>` +
      `<p>Ola, <strong>${safeStudentName}</strong>.</p>` +
      `<p>Seu acesso inicial ao Sano+ foi criado com sucesso.</p>` +
      `<div style="margin:20px 0;padding:16px;border:1px solid #dbe4f0;border-radius:12px;background:#f8fafc">` +
      `<p style="margin:0 0 8px 0"><strong>E-mail:</strong> ${safeEmail}</p>` +
      `<p style="margin:0"><strong>Senha provisoria:</strong> <span style="font-family:monospace">${safePassword}</span></p>` +
      `</div>` +
      `<p>No primeiro acesso, sera obrigatorio criar uma nova senha antes de entrar na plataforma.</p>` +
      `</div>`,
  });
}

export async function sendPasswordResetEmail(params: {
  email: string;
  resetLink: string;
}) {
  const safeEmail = escapeHtml(params.email);
  const safeResetLink = escapeHtml(params.resetLink);

  return sendWithResend({
    to: params.email,
    subject: "Redefina sua senha do Sano+",
    text:
      `Recebemos um pedido para redefinir a senha da sua conta Sano+.\n\n` +
      `Para continuar, abra o link abaixo:\n${params.resetLink}\n\n` +
      `Se voce nao solicitou esta alteracao, ignore esta mensagem.\n`,
    html:
      `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">` +
      `<h2 style="margin-bottom:16px">Redefina sua senha do Sano+</h2>` +
      `<p>Recebemos um pedido para redefinir a senha da conta <strong>${safeEmail}</strong>.</p>` +
      `<p>Use o botao abaixo para criar uma nova senha com seguranca.</p>` +
      `<p style="margin:24px 0">` +
      `<a href="${safeResetLink}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#10b981;color:#ffffff;text-decoration:none;font-weight:700">Redefinir senha</a>` +
      `</p>` +
      `<p style="font-size:14px;color:#475569">Se o botao nao abrir, copie e cole este link no navegador:</p>` +
      `<p style="font-size:14px;word-break:break-all;color:#0f172a">${safeResetLink}</p>` +
      `<p style="font-size:14px;color:#475569">Se voce nao solicitou esta alteracao, ignore esta mensagem.</p>` +
      `</div>`,
  });
}
