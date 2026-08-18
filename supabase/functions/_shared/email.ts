import { getEdgeRuntimeEnv } from "./env.ts";
import { EdgeHttpError } from "./http.ts";

// ─── Core types ───────────────────────────────────────────────────────────────

// Anexo no formato aceito pelo Resend: conteudo em base64 puro (sem data: URI).
export type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

// Teto conservador para o total de anexos. O Resend aceita mais, mas servidores
// receptores costumam recusar acima de 25 MB (Gmail). Fotos de anamnese saem
// comprimidas em ~800 KB, entao 3 fotos ficam bem abaixo disso.
export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
};

export type EmailDeliveryResult = {
  status: "sent" | "skipped" | "failed";
  provider: "resend" | "none";
  message: string;
  details?: string | null;
};

export type AnamnesisEmailData = {
  fullName: string;
  email: string;
  phone: string;
  age: number;
  weightKg: number;
  goal: string;
  experienceLevel: string;
  availableDaysPerWeek: number;
  sessionDuration: string;
  preferredTime: string;
  availableEquipment: string[];
  injuryHistory: string;
  hasTrainedBefore: boolean;
  stoppedTrainingDuration?: string | null;
  fotoFrontalUrl?: string | null;
  fotoLateralUrl?: string | null;
  fotoPosteriorUrl?: string | null;
  deepSquatScore?: number | null;
  deepSquatObs?: string | null;
  deepSquatVideoFrontalUrl?: string | null;
  deepSquatVideoLateralUrl?: string | null;
  deepSquatVideoPosteriorUrl?: string | null;
  fmsScoreTotal?: number | null;
  mediaExpiresAt?: string | null;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const GOAL_LABELS: Record<string, string> = {
  hipertrofia: "Hipertrofia",
  emagrecimento: "Emagrecimento",
  condicionamento: "Condicionamento",
  recomposicao: "Recomposição corporal",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  academia_completa: "Academia completa",
  halteres_casa: "Halteres em casa",
  elasticos: "Elásticos",
  sem_equipamento: "Sem equipamento",
};

const TIME_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

function formatEquipmentList(equipment: string[]): string {
  if (!equipment || equipment.length === 0) return "Não informado";
  return equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(", ");
}

// ─── Template primitives ──────────────────────────────────────────────────────
//
// Estrutura: header escuro com badge S+ + título + subtítulo
//            card branco com conteúdo
//            footer minimalista
//
// Compatível com Gmail, Outlook, Apple Mail (all styles inline, table-based)

function tpl(title: string, subtitle: string, bodyHtml: string): string {
  return (
    `<!DOCTYPE html><html lang="pt-BR"><head>` +
    `<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">` +
    `<title>${title}</title></head>` +
    `<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">` +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F3F4F6" style="background-color:#F3F4F6;">` +
    `<tr><td align="center" style="padding:40px 16px 32px;">` +
    // ── Card ──
    `<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:16px;overflow:hidden;">` +
    // ── Dark header ──
    `<tr>` +
    `<td align="center" bgcolor="#111827" style="background-color:#111827;padding:32px 40px 28px;text-align:center;">` +
    // Badge S+
    `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 18px;">` +
    `<tr><td align="center" bgcolor="#1D9E75" style="background-color:#1D9E75;padding:7px 18px;border-radius:8px;">` +
    `<p style="margin:0;padding:0;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:1.5px;">S+</p>` +
    `</td></tr></table>` +
    // Título
    `<p style="margin:0 0 10px;padding:0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;">${title}</p>` +
    // Subtítulo
    `<p style="margin:0;padding:0;font-size:14px;color:#9CA3AF;line-height:1.5;">${subtitle}</p>` +
    `</td></tr>` +
    // ── White body ──
    `<tr>` +
    `<td bgcolor="#ffffff" style="background-color:#ffffff;padding:36px 40px 40px;">` +
    bodyHtml +
    `</td></tr>` +
    `</table>` +
    // ── Footer ──
    `<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;margin-top:20px;">` +
    `<tr><td align="center" style="padding:0 16px 8px;">` +
    `<p style="margin:0 0 4px;padding:0;font-size:12px;color:#9CA3AF;">&copy; Sano+ 2026 &mdash; Consultoria online de musculação</p>` +
    `<p style="margin:0 0 4px;padding:0;font-size:12px;color:#9CA3AF;">Dúvidas? Responda este e-mail.</p>` +
    `<p style="margin:0;padding:0;font-size:12px;color:#9CA3AF;">Você está recebendo este e-mail porque se cadastrou em nossa plataforma.</p>` +
    `</td></tr></table>` +
    `</td></tr></table>` +
    `</body></html>`
  );
}

// Parágrafo de corpo
function p(html: string): string {
  return `<p style="margin:0 0 16px;padding:0;font-size:15px;line-height:1.7;color:#374151;">${html}</p>`;
}

// Caixa de dado rotulada — estilo "CONTA ASSOCIADA"
function dataLabel(label: string, valueHtml: string): string {
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">` +
    `<tr><td bgcolor="#F9FAFB" style="background-color:#F9FAFB;padding:14px 18px;">` +
    `<p style="margin:0 0 5px;padding:0;font-size:11px;font-weight:700;color:#6B7280;letter-spacing:0.8px;text-transform:uppercase;">${label}</p>` +
    `<p style="margin:0;padding:0;font-size:15px;color:#111827;line-height:1.4;">${valueHtml}</p>` +
    `</td></tr></table>`
  );
}

// Bloco de destaque para múltiplos campos (plano, valor, data)
function highlight(html: string): string {
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">` +
    `<tr><td bgcolor="#F9FAFB" style="background-color:#F9FAFB;padding:18px;">` +
    `<div style="font-size:15px;line-height:1.8;color:#111827;">` +
    html +
    `</div></td></tr></table>`
  );
}

// Botão CTA
function cta(label: string, url: string): string {
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">` +
    `<tr><td align="center">` +
    `<a href="${url}" style="display:inline-block;background-color:#1D9E75;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.3px;padding:14px 36px;border-radius:10px;">` +
    label +
    `</a></td></tr></table>`
  );
}

// Linha de ícones de segurança/confiança
function trustRow(items: Array<{ emoji: string; label: string }>): string {
  const cols = items
    .map(
      (item) =>
        `<td align="center" style="padding:6px 16px;">` +
        `<p style="margin:0 0 5px;padding:0;font-size:26px;line-height:1;">${item.emoji}</p>` +
        `<p style="margin:0;padding:0;font-size:12px;color:#6B7280;line-height:1.3;">${item.label}</p>` +
        `</td>`,
    )
    .join("");

  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">` +
    `<tr><td align="center">` +
    `<p style="margin:0 0 14px;padding:0;font-size:11px;font-weight:700;color:#6B7280;letter-spacing:0.8px;text-transform:uppercase;">Sua segurança é prioridade</p>` +
    `<table cellpadding="0" cellspacing="0" border="0"><tr>${cols}</tr></table>` +
    `</td></tr></table>`
  );
}

// Caixa de aviso/disclaimer
function disclaimerBox(text: string): string {
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">` +
    `<tr><td bgcolor="#F9FAFB" style="background-color:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:14px 18px;">` +
    `<p style="margin:0;padding:0;font-size:13px;color:#6B7280;line-height:1.6;">&#x1F6E1;&#xFE0F; ${text}</p>` +
    `</td></tr></table>`
  );
}

// Bloco âmbar de aviso de retenção de mídia — inserido antes do CTA no e-mail do professor
function mediaRetentionWarning(expiresAt: string, downloadLink: string): string {
  const dateFormatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(expiresAt));

  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">` +
    `<tr>` +
    `<td style="border-left:4px solid #F59E0B;background-color:#FFF3CD;border-radius:0 8px 8px 0;padding:14px 18px;">` +
    `<p style="margin:0 0 6px;padding:0;font-size:14px;font-weight:700;color:#92400E;">` +
    `&#9888;&#65039; ATENÇÃO — Faça o download das mídias em até 48 horas` +
    `</p>` +
    `<p style="margin:0 0 10px;padding:0;font-size:13px;color:#78350F;line-height:1.6;">` +
    `As fotos e vídeos desta anamnese serão <strong>deletados automaticamente no dia ${dateFormatted}</strong>. ` +
    `Após essa data não será possível recuperá-los. Faça o download agora pelo painel.` +
    `</p>` +
    `<a href="${downloadLink}" style="display:inline-block;background-color:#DC2626;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 20px;border-radius:8px;">` +
    `Baixar mídias agora` +
    `</a>` +
    `</td>` +
    `</tr></table>`
  );
}

// Bloco vermelho de urgência — lembrete 48h
function mediaUrgencyBox(studentName: string, expiresAt: string, downloadLink: string): string {
  const dateFormatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(expiresAt));

  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">` +
    `<tr>` +
    `<td style="background-color:#FEE2E2;border:1px solid #EF4444;border-radius:10px;padding:18px;">` +
    `<p style="margin:0 0 8px;padding:0;font-size:15px;font-weight:700;color:#991B1B;">` +
    `&#128308; Deleção permanente em menos de 48 horas` +
    `</p>` +
    `<p style="margin:0 0 12px;padding:0;font-size:14px;color:#7F1D1D;line-height:1.6;">` +
    `As fotos e vídeos da anamnese de <strong>${escapeHtml(studentName)}</strong> serão deletados permanentemente em ` +
    `<strong>${dateFormatted}</strong>. Esta ação não pode ser desfeita.` +
    `</p>` +
    `<a href="${downloadLink}" style="display:inline-block;background-color:#DC2626;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;">` +
    `Baixar agora — últimas 48 horas` +
    `</a>` +
    `</td>` +
    `</tr></table>`
  );
}

// Divisória e assinatura
function divider(): string {
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">` +
    `<tr><td style="border-top:1px solid #E5E7EB;font-size:0;line-height:0;">&nbsp;</td></tr></table>`
  );
}

function signoff(name?: string | null): string {
  const signer = name ? escapeHtml(name) : "Equipe Sano+";
  return (
    divider() +
    `<p style="margin:0;padding:0;font-size:15px;line-height:1.7;color:#374151;">Com carinho,<br>` +
    `<strong style="color:#111827;">${signer}</strong></p>`
  );
}

// ─── Send via Resend ──────────────────────────────────────────────────────────

async function sendWithResend(input: SendTransactionalEmailInput): Promise<EmailDeliveryResult> {
  const env = getEdgeRuntimeEnv();
  if (!env.resendApiKey || !env.resendFromEmail) {
    return { status: "skipped", provider: "none", message: "Envio de e-mail nao configurado no ambiente." };
  }

  const from = env.resendFromName ? `${env.resendFromName} <${env.resendFromEmail}>` : env.resendFromEmail;

  // Anexos que estourem o teto sao descartados em bloco: melhor o professor
  // receber a ficha sem as fotos do que o envio inteiro falhar com 413.
  let attachments = input.attachments ?? [];
  if (attachments.length > 0) {
    const totalBytes = attachments.reduce((sum, a) => sum + Math.ceil((a.content.length * 3) / 4), 0);
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      console.warn(`[email] anexos descartados: ${totalBytes} bytes excedem o limite de ${MAX_TOTAL_ATTACHMENT_BYTES}.`);
      attachments = [];
    }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(attachments.length > 0 ? { attachments } : {}),
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new EdgeHttpError("email_send_failed", "O envio do e-mail falhou.", 502, {
      provider: "resend",
      responseStatus: response.status,
      responseBody: raw || null,
    });
  }

  return { status: "sent", provider: "resend", message: "E-mail enviado com sucesso." };
}

function catchEmailError(error: unknown, message: string): EmailDeliveryResult {
  const details = error instanceof EdgeHttpError ? error.details : null;
  const rs = details && typeof details === "object" && "responseStatus" in details ? String(details.responseStatus ?? "") : null;
  const rb = details && typeof details === "object" && "responseBody" in details ? String(details.responseBody ?? "") : null;
  return {
    status: "failed",
    provider: "resend",
    message,
    details: [rs, rb].filter(Boolean).join(" - ") || (error instanceof Error ? error.message : null),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1. Senha temporária → aluno ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendStudentTemporaryAccessEmail(params: {
  studentName: string;
  email: string;
  accessLink: string;
  temporaryPassword: string;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.studentName);
  const safeEmail = escapeHtml(params.email);
  const safeLink = escapeHtml(params.accessLink);
  const safePass = escapeHtml(params.temporaryPassword);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Seu acesso ao Sano+ está pronto 🔐",
      text:
        `Olá, ${params.studentName}!\n\n` +
        `Seu acesso ao Sano+ foi criado. Use as informações abaixo:\n\n` +
        `Link: ${params.accessLink}\nE-mail: ${params.email}\nSenha provisória: ${params.temporaryPassword}\n\n` +
        `No primeiro acesso, você criará uma nova senha.\nEquipe Sano+`,
      html: tpl(
        "Seu acesso chegou!",
        "Tudo pronto para você começar",
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>! Seu professor criou o seu acesso no Sano+.`) +
        p("Use as informações abaixo para entrar pela primeira vez:") +
        dataLabel("Link de acesso", `<a href="${safeLink}" style="color:#1D9E75;word-break:break-all;">${safeLink}</a>`) +
        dataLabel("E-mail", safeEmail) +
        dataLabel("Senha provisória", `<span style="font-family:Courier New,Courier,monospace;font-size:16px;letter-spacing:2px;color:#111827;">${safePass}</span>`) +
        p("<span style=\"font-size:13px;color:#6B7280;\">No primeiro acesso, você vai criar uma senha nova. Depois disso, é só treinar! 💪</span>") +
        cta("Acessar o Sano+", params.accessLink) +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "A conta foi criada, mas o envio do e-mail com a senha provisória falhou.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 2. Redefinição de senha ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendPasswordResetEmail(params: {
  email: string;
  resetLink: string;
}): Promise<EmailDeliveryResult> {
  const safeEmail = escapeHtml(params.email);
  const safeLink = escapeHtml(params.resetLink);

  return sendWithResend({
    to: params.email,
    subject: "Redefinição de senha — Sano+",
    text:
      `Olá!\n\n` +
      `Recebemos uma solicitação de redefinição de senha para a conta ${params.email}.\n\n` +
      `Acesse o link para criar uma nova senha:\n${params.resetLink}\n\n` +
      `Se não foi você, ignore este e-mail.\nEquipe Sano+`,
    html: tpl(
      "Redefinir sua senha",
      "Recupere o acesso à sua conta com segurança",
      p("Olá!") +
      p("Recebemos uma solicitação para redefinir a senha da conta abaixo. Clique no botão para criar uma nova senha:") +
      dataLabel("Conta associada", `<a href="mailto:${safeEmail}" style="color:#1D9E75;">${safeEmail}</a>`) +
      cta("Redefinir senha", params.resetLink) +
      p(`<span style="font-size:13px;color:#6B7280;">Se o botão não funcionar, copie e cole este link no navegador:<br><a href="${safeLink}" style="color:#1D9E75;word-break:break-all;font-size:12px;">${safeLink}</a></span>`) +
      trustRow([
        { emoji: "🔒", label: "Acesso seguro" },
        { emoji: "🔑", label: "Link único" },
        { emoji: "⏰", label: "Link com expiração" },
      ]) +
      disclaimerBox("Se você não solicitou a redefinição de senha, ignore este e-mail com segurança. Sua senha atual permanecerá inalterada.") +
      signoff()
    ),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 3. Lead capturado → aluno ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendLeadCapturedEmail(params: {
  fullName: string;
  email: string;
  anamnesisLink: string;
  coachName?: string | null;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.fullName);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Bem-vindo ao Sano+ 👋",
      text:
        `Olá, ${params.fullName}!\n\nCadastro registrado com sucesso.\n\nO próximo passo é preencher a ficha de avaliação:\n${params.anamnesisLink}\n\nEquipe Sano+`,
      html: tpl(
        "Bem-vindo ao Sano+!",
        "Seu cadastro foi registrado com sucesso",
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>! Fico feliz em ter você aqui.`) +
        p("O próximo passo é preencher a sua ficha de avaliação. Com ela, consigo montar um treino 100% personalizado para o seu perfil:") +
        highlight(
          `<p style="margin:0 0 6px;padding:0;font-size:13px;font-weight:700;color:#6B7280;letter-spacing:0.5px;text-transform:uppercase;">O que vem por aí</p>` +
          `<p style="margin:0;padding:0;font-size:14px;line-height:1.8;color:#374151;">&#10003; Treino adaptado ao seu nível e disponibilidade<br>` +
          `&#10003; Exercícios seguros para o seu histórico<br>` +
          `&#10003; Acompanhamento e suporte contínuo</p>`
        ) +
        p("<span style=\"font-size:13px;color:#6B7280;\">Leva menos de 10 minutos. Pode fazer agora mesmo:</span>") +
        cta("Preencher minha ficha de avaliação", params.anamnesisLink) +
        signoff(params.coachName)
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar e-mail de confirmação de cadastro.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 4. Lembrete de ficha — 24h → aluno ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendAnamnesisReminder24hEmail(params: {
  fullName: string;
  email: string;
  anamnesisLink: string;
  coachName?: string | null;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.fullName);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Sua ficha de avaliação está esperando 📝",
      text:
        `Olá, ${params.fullName}!\n\nSua ficha de avaliação ainda não foi preenchida. Leva menos de 10 minutos:\n${params.anamnesisLink}\n\nEquipe Sano+`,
      html: tpl(
        "Sua ficha está esperando",
        "Um detalhe antes de começarmos",
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>!`) +
        p("Percebi que a ficha de avaliação ainda não foi preenchida. Tudo bem — a rotina aperta! Mas é por lá que tudo começa.") +
        highlight(
          `<p style="margin:0 0 6px;padding:0;font-size:13px;font-weight:700;color:#6B7280;letter-spacing:0.5px;text-transform:uppercase;">O que preciso saber</p>` +
          `<p style="margin:0;padding:0;font-size:14px;line-height:1.8;color:#374151;">&#10003; Seu nível de experiência e disponibilidade<br>` +
          `&#10003; Objetivos e equipamentos disponíveis<br>` +
          `&#10003; Histórico de lesões e limitações</p>`
        ) +
        cta("Completar meu cadastro", params.anamnesisLink) +
        p("<span style=\"font-size:13px;color:#6B7280;\">Leva menos de 10 minutos. Estou esperando para começar!</span>") +
        signoff(params.coachName)
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar lembrete de ficha (24h).");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 5. Lembrete de ficha — 72h → aluno ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendAnamnesisReminder72hEmail(params: {
  fullName: string;
  email: string;
  anamnesisLink: string;
  coachName?: string | null;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.fullName);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Última chamada: complete seu cadastro ⏰",
      text:
        `Olá, ${params.fullName}!\n\nSua vaga na consultoria continua reservada. Só falta a ficha de avaliação:\n${params.anamnesisLink}\n\nEquipe Sano+`,
      html: tpl(
        "Sua vaga está reservada",
        "Ainda dá tempo de começar",
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>!`) +
        p("Sua vaga na consultoria continua guardada para você. Só preciso de uma coisa: a sua ficha de avaliação.") +
        dataLabel("O que está esperando por você", "Treino personalizado, acompanhamento e suporte direto. Tudo começa na ficha de avaliação.") +
        cta("Quero começar agora", params.anamnesisLink) +
        signoff(params.coachName)
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar lembrete de ficha (72h).");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 6. Boas-vindas pós-anamnese → aluno ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendAnamnesisWelcomeEmail(params: {
  fullName: string;
  email: string;
  coachName?: string | null;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.fullName);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Ficha recebida — vamos começar! 💪",
      text:
        `Olá, ${params.fullName}!\n\nRecebi sua ficha e já estou analisando. Em até 48 horas você recebe seu treino personalizado.\n\n` +
        (params.coachName ?? "Equipe Sano+"),
      html: tpl(
        "Ficha recebida!",
        "Sua avaliação chegou, vamos trabalhar!",
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>! Que começo incrível.`) +
        p("Recebi sua ficha de avaliação e já estou analisando tudo. Em breve você vai ter um treino montado especificamente para o seu perfil e objetivos.") +
        highlight(
          `<p style="margin:0 0 6px;padding:0;font-size:13px;font-weight:700;color:#6B7280;letter-spacing:0.5px;text-transform:uppercase;">O que acontece agora</p>` +
          `<p style="margin:0;padding:0;font-size:14px;line-height:1.9;color:#374151;">1. Analiso seu perfil e objetivos cuidadosamente<br>` +
          `2. Monto seu treino personalizado<br>` +
          `3. Em até <strong style="color:#111827;">48 horas</strong>, você recebe tudo por e-mail para começar</p>`
        ) +
        p("<span style=\"font-size:13px;color:#6B7280;\">Fique de olho na caixa de entrada. Qualquer dúvida, é só responder este e-mail.</span>") +
        signoff(params.coachName)
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar e-mail de boas-vindas pós-anamnese.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 7. Nova anamnese → professor ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendAnamnesisCoachNotificationEmail(params: {
  coachEmail: string;
  coachName?: string | null;
  data: AnamnesisEmailData;
  reviewLink: string;
  // As fotos vao anexadas para o professor ficar com uma copia propria: as URLs
  // publicas usadas no <img> abaixo morrem quando a midia e purgada do storage.
  attachments?: EmailAttachment[];
}): Promise<EmailDeliveryResult> {
  const d = params.data;
  const safeName = escapeHtml(d.fullName);
  const safeEmail = escapeHtml(d.email);
  const safePhone = escapeHtml(d.phone);
  const safeInjury = escapeHtml(d.injuryHistory);
  const goalLabel = GOAL_LABELS[d.goal] ?? d.goal;
  const expLabel = EXPERIENCE_LABELS[d.experienceLevel] ?? d.experienceLevel;
  const timeLabel = TIME_LABELS[d.preferredTime] ?? d.preferredTime;
  const equipmentList = formatEquipmentList(d.availableEquipment);
  const trainedBefore = d.hasTrainedBefore
    ? `Sim${d.stoppedTrainingDuration ? ` (parou há ${escapeHtml(d.stoppedTrainingDuration)})` : ""}`
    : "Não";

  const row = (label: string, value: string, even = false): string =>
    `<tr${even ? ` bgcolor="#F9FAFB"` : ""}>` +
    `<td width="38%" style="padding:9px 14px;font-size:12px;font-weight:600;color:#6B7280;letter-spacing:0.3px;text-transform:uppercase;border-bottom:1px solid #E5E7EB;white-space:nowrap;">${label}</td>` +
    `<td style="padding:9px 14px;font-size:14px;color:#111827;border-bottom:1px solid #E5E7EB;">${value}</td>` +
    `</tr>`;

  const sectionHead = (text: string): string =>
    `<tr bgcolor="#1D9E75">` +
    `<td colspan="2" style="padding:8px 14px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.8px;text-transform:uppercase;background-color:#1D9E75;">${text}</td>` +
    `</tr>`;

  try {
    return await sendWithResend({
      to: params.coachEmail,
      subject: `Nova ficha de avaliação — ${d.fullName}`,
      text:
        `Nova ficha recebida!\n\nAluno: ${d.fullName} | ${d.email} | ${d.phone}\n` +
        `Objetivo: ${goalLabel} | Nível: ${expLabel} | ${d.availableDaysPerWeek}x/sem\n` +
        `Equipamentos: ${equipmentList} | Já treinou: ${trainedBefore}\n` +
        `Lesões: ${d.injuryHistory}\n\nVer no painel: ${params.reviewLink}\n\nEquipe Sano+`,
      html: tpl(
        "Nova ficha de avaliação!",
        "Um aluno preencheu a avaliação",
        p("Confira os dados abaixo para começar a montar o treino:") +
        `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin:16px 0;">` +
        sectionHead("Dados do aluno") +
        row("Nome", safeName) +
        row("E-mail", safeEmail, true) +
        row("Telefone", safePhone) +
        row("Idade", `${d.age} anos`, true) +
        row("Peso", `${d.weightKg} kg`) +
        sectionHead("Perfil de treino") +
        row("Objetivo", goalLabel) +
        row("Nível", expLabel, true) +
        row("Dias/semana", `${d.availableDaysPerWeek} dias`) +
        row("Duração", d.sessionDuration, true) +
        row("Horário", timeLabel) +
        row("Equipamentos", equipmentList, true) +
        row("Já treinou?", trainedBefore) +
        row("Lesões / limitações", safeInjury, true) +
        (d.deepSquatScore !== null && d.deepSquatScore !== undefined
          ? sectionHead("Avaliação funcional") +
            row("Deep Squat", `${d.deepSquatScore}/3`) +
            (d.deepSquatObs ? row("Obs.", escapeHtml(d.deepSquatObs), true) : "") +
            (d.fmsScoreTotal !== null && d.fmsScoreTotal !== undefined ? row("Score total", String(d.fmsScoreTotal)) : "")
          : "") +
        `</table>` +
        (d.deepSquatVideoFrontalUrl || d.deepSquatVideoLateralUrl || d.deepSquatVideoPosteriorUrl
          ? `<p style="margin:16px 0 8px;padding:0;font-size:12px;font-weight:700;color:#6B7280;letter-spacing:0.5px;text-transform:uppercase;">Vídeos Deep Squat</p>` +
            `<table cellpadding="0" cellspacing="0" border="0"><tr>` +
            (d.deepSquatVideoFrontalUrl ? `<td style="padding-right:8px;"><a href="${escapeHtml(d.deepSquatVideoFrontalUrl)}" style="display:inline-block;background-color:#1D9E75;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;">&#9654; Frontal</a></td>` : "") +
            (d.deepSquatVideoLateralUrl ? `<td style="padding-right:8px;"><a href="${escapeHtml(d.deepSquatVideoLateralUrl)}" style="display:inline-block;background-color:#1D9E75;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;">&#9654; Lateral</a></td>` : "") +
            (d.deepSquatVideoPosteriorUrl ? `<td><a href="${escapeHtml(d.deepSquatVideoPosteriorUrl)}" style="display:inline-block;background-color:#1D9E75;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;">&#9654; Posterior</a></td>` : "") +
            `</tr></table>`
          // Sem videos no registro: o aluno foi orientado a manda-los pelo WhatsApp,
          // porque 3 arquivos de ate 15 MB nao trafegam por e-mail.
          : `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border:1px solid #D1FAE5;border-radius:10px;background-color:#F0FDF4;">` +
            `<tr><td style="padding:12px 14px;font-size:14px;color:#065F46;line-height:1.6;">` +
            `<strong>Vídeos do Deep Squat:</strong> o aluno foi orientado a enviá-los pelo seu WhatsApp. ` +
            `Se ainda não chegaram, chame ${escapeHtml(d.fullName)} no ${escapeHtml(d.phone)}.` +
            `</td></tr></table>`) +
        (d.fotoFrontalUrl || d.fotoLateralUrl || d.fotoPosteriorUrl
          ? `<p style="margin:16px 0 8px;padding:0;font-size:12px;font-weight:700;color:#6B7280;letter-spacing:0.5px;text-transform:uppercase;">Fotos posturais${
              (params.attachments?.length ?? 0) > 0 ? " — em anexo neste e-mail" : ""
            }</p>` +
            `<table cellpadding="0" cellspacing="0" border="0"><tr>` +
            (d.fotoFrontalUrl ? `<td style="padding-right:10px;text-align:center;vertical-align:top;"><a href="${escapeHtml(d.fotoFrontalUrl)}" target="_blank"><img src="${escapeHtml(d.fotoFrontalUrl)}" alt="Frontal" width="158" height="198" style="width:158px;height:198px;object-fit:cover;border-radius:8px;border:1px solid #E5E7EB;display:block;"></a><p style="margin:5px 0 0;font-size:12px;color:#6B7280;text-align:center;">Frontal</p></td>` : "") +
            (d.fotoLateralUrl ? `<td style="padding-right:10px;text-align:center;vertical-align:top;"><a href="${escapeHtml(d.fotoLateralUrl)}" target="_blank"><img src="${escapeHtml(d.fotoLateralUrl)}" alt="Lateral" width="158" height="198" style="width:158px;height:198px;object-fit:cover;border-radius:8px;border:1px solid #E5E7EB;display:block;"></a><p style="margin:5px 0 0;font-size:12px;color:#6B7280;text-align:center;">Lateral</p></td>` : "") +
            (d.fotoPosteriorUrl ? `<td style="text-align:center;vertical-align:top;"><a href="${escapeHtml(d.fotoPosteriorUrl)}" target="_blank"><img src="${escapeHtml(d.fotoPosteriorUrl)}" alt="Posterior" width="158" height="198" style="width:158px;height:198px;object-fit:cover;border-radius:8px;border:1px solid #E5E7EB;display:block;"></a><p style="margin:5px 0 0;font-size:12px;color:#6B7280;text-align:center;">Posterior</p></td>` : "") +
            `</tr></table>`
          : "") +
        (d.mediaExpiresAt
          ? mediaRetentionWarning(d.mediaExpiresAt, params.reviewLink)
          : "") +
        cta("Ver perfil completo", params.reviewLink) +
        signoff()
      ),
      attachments: params.attachments,
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar notificação de ficha ao professor.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 8. Pagamento aprovado → aluno ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendPaymentApprovedEmail(params: {
  email: string;
  studentName: string;
  planName: string;
  amount: number;
  renewalDate: string;
  accessLink: string;
  temporaryPassword?: string | null;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.studentName);
  const safePlan = escapeHtml(params.planName);
  const safeLink = escapeHtml(params.accessLink);
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(params.amount);
  const dateFormatted = new Date(params.renewalDate + "T00:00:00Z").toLocaleDateString("pt-BR");

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Pagamento aprovado — bem-vindo ao Sano+! ✅",
      text:
        `Olá, ${params.studentName}!\n\nPagamento aprovado! Bem-vindo ao plano ${params.planName}.\n\n` +
        `Plano: ${params.planName} | Valor: ${formatted}/mês | Renovação: ${dateFormatted}\n\n` +
        (params.temporaryPassword ? `Acesso: ${params.accessLink}\nSenha temporária: ${params.temporaryPassword}\n\n` : `App: ${params.accessLink}\n\n`) +
        `Equipe Sano+`,
      html: tpl(
        "Pagamento aprovado!",
        `Bem-vindo ao plano ${safePlan}`,
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>! Tudo certo com o pagamento.`) +
        dataLabel("Plano contratado", `<strong>${safePlan}</strong>`) +
        dataLabel("Valor cobrado", `<strong style="color:#1D9E75;">${formatted}/mês</strong>`) +
        dataLabel("Próxima renovação", dateFormatted) +
        (params.temporaryPassword
          ? dataLabel("Link de acesso", `<a href="${safeLink}" style="color:#1D9E75;word-break:break-all;">${safeLink}</a>`) +
            dataLabel("Senha temporária", `<span style="font-family:Courier New,Courier,monospace;font-size:16px;letter-spacing:2px;">${escapeHtml(params.temporaryPassword)}</span>`) +
            p("<span style=\"font-size:13px;color:#6B7280;\">No primeiro acesso, você criará uma nova senha personalizada.</span>") +
            cta("Acessar o Sano+", params.accessLink)
          : cta("Acessar meu app", params.accessLink)) +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar e-mail de pagamento aprovado.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 9. Nova assinatura → professor ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendCoachNewSubscriptionEmail(params: {
  coachEmail: string;
  studentName: string;
  studentEmail: string;
  planName: string;
  amount: number;
  reviewLink: string;
}): Promise<EmailDeliveryResult> {
  const safeSName = escapeHtml(params.studentName);
  const safeSEmail = escapeHtml(params.studentEmail);
  const safePlan = escapeHtml(params.planName);
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(params.amount);

  try {
    return await sendWithResend({
      to: params.coachEmail,
      subject: `Nova assinatura confirmada — ${params.studentName}`,
      text: `Nova assinatura!\n\nAluno: ${params.studentName} (${params.studentEmail})\nPlano: ${params.planName} | Valor: ${formatted}/mês\n\nVer painel: ${params.reviewLink}\n\nEquipe Sano+`,
      html: tpl(
        "Nova assinatura!",
        "Um aluno acabou de confirmar",
        p("Boa notícia! Um aluno acabou de assinar. Confira os detalhes:") +
        dataLabel("Aluno", `<strong>${safeSName}</strong>`) +
        dataLabel("E-mail", safeSEmail) +
        dataLabel("Plano", safePlan) +
        dataLabel("Valor recebido", `<strong style="color:#1D9E75;">${formatted}/mês</strong>`) +
        cta("Ver perfil do aluno", params.reviewLink) +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar e-mail de nova assinatura ao professor.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 10. Pagamento pendente → aluno ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendPaymentPendingEmail(params: {
  email: string;
  studentName: string;
  planName: string;
  amount: number;
  retryLink?: string | null;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.studentName);
  const safePlan = escapeHtml(params.planName);
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(params.amount);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Pagamento em análise — Sano+ ⏳",
      text: `Olá, ${params.studentName}!\n\nRecebemos seu comprovante do plano ${params.planName} (${formatted}/mês). Seu personal vai conferir e liberar seu acesso em até 48 horas.\n\nEquipe Sano+`,
      html: tpl(
        "Pagamento em análise",
        "Seu personal vai conferir o comprovante",
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>! Comprovante recebido.`) +
        // O PIX aqui e manual: quem confere e aprova e o professor, nao um gateway.
        // A copia anterior prometia confirmacao automatica "pelo banco" e citava
        // cartao de credito, que nao existe neste fluxo.
        p("Seu personal foi notificado e vai conferir o pagamento. Assim que aprovar, você recebe um e-mail com os dados de acesso.") +
        dataLabel("Plano solicitado", safePlan) +
        dataLabel("Valor", `${formatted}/mês`) +
        p("<span style=\"font-size:13px;color:#6B7280;\">A liberação costuma sair em até 48 horas.</span>") +
        (params.retryLink ? cta("Voltar ao pagamento", params.retryLink) : "") +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar e-mail de pagamento pendente.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 11. Pagamento recusado → aluno ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendPaymentRejectedEmail(params: {
  email: string;
  studentName: string;
  planName: string;
  retryLink: string;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.studentName);
  const safePlan = escapeHtml(params.planName);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Pagamento não aprovado — Sano+",
      text: `Olá, ${params.studentName}!\n\nO pagamento para o plano ${params.planName} não foi aprovado. Você pode tentar novamente:\n${params.retryLink}\n\nEquipe Sano+`,
      html: tpl(
        "Pagamento não aprovado",
        "Mas tem como resolver, não se preocupe",
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>!`) +
        p(`O pagamento para o plano <strong>${safePlan}</strong> não foi aprovado desta vez. Isso pode acontecer por limite no cartão, dados divergentes ou uma recusa preventiva do banco.`) +
        p("A boa notícia é que você pode tentar novamente agora, inclusive com outro método de pagamento:") +
        cta("Tentar novamente", params.retryLink) +
        disclaimerBox("Se o problema persistir, responda este e-mail e resolvo com você.") +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar e-mail de pagamento recusado.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 12. Pagamento recusado → professor ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendCoachPaymentRejectedEmail(params: {
  coachEmail: string;
  studentName: string;
  studentEmail: string;
  planName: string;
  paymentMethod?: string | null;
  reviewLink: string;
}): Promise<EmailDeliveryResult> {
  const safeSName = escapeHtml(params.studentName);
  const safeSEmail = escapeHtml(params.studentEmail);
  const safePlan = escapeHtml(params.planName);
  const safeMethod = params.paymentMethod ? escapeHtml(params.paymentMethod) : "Não informado";

  try {
    return await sendWithResend({
      to: params.coachEmail,
      subject: `Pagamento não aprovado — ${params.studentName}`,
      text: `O pagamento de ${params.studentName} (${params.studentEmail}) para o plano ${params.planName} não foi aprovado.\nMétodo: ${safeMethod}\n\nVer perfil: ${params.reviewLink}\n\nEquipe Sano+`,
      html: tpl(
        "Pagamento não aprovado",
        "Um aluno pode precisar da sua ajuda",
        p("Um aluno tentou assinar, mas o pagamento não foi aprovado. Pode valer entrar em contato:") +
        dataLabel("Aluno", `<strong>${safeSName}</strong>`) +
        dataLabel("E-mail", safeSEmail) +
        dataLabel("Plano tentado", safePlan) +
        dataLabel("Método de pagamento", safeMethod) +
        cta("Ver perfil do aluno", params.reviewLink) +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar e-mail de rejeição ao professor.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 13. PIX aguardando aprovação → professor ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendCoachPixPendingEmail(params: {
  coachEmail: string;
  studentName: string;
  studentEmail: string;
  planName: string;
  amount: number;
  payerNote?: string | null;
  reviewLink: string;
}): Promise<EmailDeliveryResult> {
  const safeSName = escapeHtml(params.studentName);
  const safeSEmail = escapeHtml(params.studentEmail);
  const safePlan = escapeHtml(params.planName);
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(params.amount);

  try {
    return await sendWithResend({
      to: params.coachEmail,
      subject: `PIX aguardando aprovação — ${params.studentName}`,
      text:
        `Novo PIX pendente!\n\nAluno: ${params.studentName} (${params.studentEmail})\nPlano: ${params.planName} — ${formatted}/mês\n` +
        (params.payerNote ? `Obs.: ${params.payerNote}\n` : "") +
        `\nAprovar: ${params.reviewLink}\n\nEquipe Sano+`,
      html: tpl(
        "PIX aguardando aprovação",
        "Um aluno enviou o comprovante",
        p("Um aluno informou que realizou o pagamento via PIX. Confira na sua conta e aprove:") +
        dataLabel("Aluno", `<strong>${safeSName}</strong>`) +
        dataLabel("E-mail", safeSEmail) +
        dataLabel("Plano", safePlan) +
        dataLabel("Valor", `<strong style="color:#1D9E75;">${formatted}/mês</strong>`) +
        (params.payerNote ? dataLabel("Observação do aluno", `<em>${escapeHtml(params.payerNote)}</em>`) : "") +
        p("<span style=\"font-size:13px;color:#6B7280;\">Verifique o recebimento na sua conta Pix antes de aprovar.</span>") +
        cta("Aprovar pagamento", params.reviewLink) +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar e-mail de PIX pendente ao professor.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 14. Aviso de vencimento 3 dias → aluno ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendRenewalWarningEmail(params: {
  email: string;
  studentName: string;
  planName: string;
  renewalDate: string;
  renewLink: string;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.studentName);
  const safePlan = escapeHtml(params.planName);
  const dateFormatted = new Date(params.renewalDate + "T00:00:00Z").toLocaleDateString("pt-BR");

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Sua assinatura vence em 3 dias — Sano+",
      text: `Olá, ${params.studentName}!\n\nSua assinatura do plano ${params.planName} vence em ${dateFormatted}.\n\nRenove para continuar sem interrupção:\n${params.renewLink}\n\nEquipe Sano+`,
      html: tpl(
        "Assinatura vencendo",
        "Faltam 3 dias para a renovação",
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>!`) +
        p(`Sua assinatura do plano <strong>${safePlan}</strong> vence em <strong>${dateFormatted}</strong>. Para continuar treinando sem nenhuma interrupção, renove antes da data.`) +
        dataLabel("Plano atual", safePlan) +
        dataLabel("Data de vencimento", `<strong>${dateFormatted}</strong>`) +
        cta("Falar com o professor", params.renewLink) +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar aviso de vencimento.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 15. Resumo de renovações → professor ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendCoachRenewalWarningEmail(params: {
  coachEmail: string;
  renewalDate: string;
  students: Array<{ name: string; email: string; planName: string }>;
  dashboardLink: string;
}): Promise<EmailDeliveryResult> {
  const dateFormatted = new Date(params.renewalDate + "T00:00:00Z").toLocaleDateString("pt-BR");
  const count = params.students.length;

  const rows = params.students
    .map((s, i) =>
      `<tr${i % 2 === 1 ? ` bgcolor="#F9FAFB"` : ""}>` +
      `<td style="padding:10px 14px;font-size:14px;color:#111827;border-bottom:1px solid #E5E7EB;">${escapeHtml(s.name)}</td>` +
      `<td style="padding:10px 14px;font-size:14px;color:#374151;border-bottom:1px solid #E5E7EB;">${escapeHtml(s.email)}</td>` +
      `<td style="padding:10px 14px;font-size:14px;color:#374151;border-bottom:1px solid #E5E7EB;">${escapeHtml(s.planName)}</td>` +
      `</tr>`,
    )
    .join("");

  try {
    return await sendWithResend({
      to: params.coachEmail,
      subject: `${count} aluno${count !== 1 ? "s" : ""} com renovação em 3 dias`,
      text:
        `Olá!\n\n${count} aluno${count !== 1 ? "s" : ""} com renovação em ${dateFormatted}:\n\n` +
        params.students.map((s) => `- ${s.name} (${s.email}) — ${s.planName}`).join("\n") +
        `\n\nPainel: ${params.dashboardLink}\n\nEquipe Sano+`,
      html: tpl(
        "Renovações nos próximos 3 dias",
        "Acompanhe seus alunos ativos",
        p(`Você tem <strong style="color:#111827;">${count} aluno${count !== 1 ? "s" : ""}</strong> com assinatura vencendo em <strong>${dateFormatted}</strong>:`) +
        `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin:16px 0;">` +
        `<tr bgcolor="#1D9E75">` +
        `<th style="padding:10px 14px;font-size:11px;font-weight:700;color:#fff;text-align:left;letter-spacing:0.5px;text-transform:uppercase;background-color:#1D9E75;">Aluno</th>` +
        `<th style="padding:10px 14px;font-size:11px;font-weight:700;color:#fff;text-align:left;letter-spacing:0.5px;text-transform:uppercase;background-color:#1D9E75;">E-mail</th>` +
        `<th style="padding:10px 14px;font-size:11px;font-weight:700;color:#fff;text-align:left;letter-spacing:0.5px;text-transform:uppercase;background-color:#1D9E75;">Plano</th>` +
        `</tr>` +
        rows +
        `</table>` +
        cta("Ver painel de assinaturas", params.dashboardLink) +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar resumo de renovações ao professor.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 16. Assinatura expirada → aluno ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 17. Lembrete 48h antes da deleção de mídia → professor ──────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendMediaDeletionReminderEmail(params: {
  coachEmail: string;
  studentName: string;
  mediaExpiresAt: string;
  hasPhotos: boolean;
  hasVideos: boolean;
  downloadLink: string;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.studentName);
  const dateFormatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(params.mediaExpiresAt));

  const mediaList: string[] = [];
  if (params.hasPhotos) {
    mediaList.push("Foto frontal", "Foto lateral", "Foto posterior");
  }
  if (params.hasVideos) {
    mediaList.push("Vídeo Deep Squat (frontal)", "Vídeo Deep Squat (lateral)", "Vídeo Deep Squat (posterior)");
  }

  const mediaListHtml = mediaList
    .map((item) => `<li style="margin:3px 0;font-size:14px;color:#374151;">&#9656; ${item}</li>`)
    .join("");

  try {
    return await sendWithResend({
      to: params.coachEmail,
      subject: `⚠️ Mídias de ${params.studentName} serão deletadas em 48 horas`,
      text:
        `ATENÇÃO!\n\nAs mídias da anamnese de ${params.studentName} serão deletadas em ${dateFormatted}.\n\n` +
        `Arquivos: ${mediaList.join(", ")}\n\n` +
        `Faça o download agora: ${params.downloadLink}\n\n` +
        `Se já fez o download, pode ignorar este aviso.\n\nEquipe Sano+`,
      html: tpl(
        "⚠️ Mídias deletadas em 48h",
        `Anamnese de ${safeName} — ação necessária`,
        mediaUrgencyBox(params.studentName, params.mediaExpiresAt, params.downloadLink) +
        p(`Os seguintes arquivos serão deletados permanentemente:`) +
        `<ul style="margin:0 0 16px;padding-left:0;list-style:none;">${mediaListHtml}</ul>` +
        cta("Baixar todas as mídias agora", params.downloadLink) +
        `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;">` +
        `<tr><td bgcolor="#F9FAFB" style="background-color:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:12px 16px;">` +
        `<p style="margin:0;padding:0;font-size:12px;color:#6B7280;line-height:1.5;">` +
        `Se você já fez o download, pode ignorar este aviso. ` +
        `Os dados textuais da anamnese (informações do aluno, pontuações e objetivos) permanecem disponíveis normalmente no painel.` +
        `</p></td></tr></table>` +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar lembrete de deleção de mídia.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 18. Confirmação pós-deleção de mídia → professor ────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendMediaDeletedConfirmationEmail(params: {
  coachEmail: string;
  studentName: string;
  deletedAt: string;
  filesDeleted: string[];
  panelLink: string;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.studentName);
  const dateFormatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(params.deletedAt));

  const filesHtml = params.filesDeleted
    .map((f) => `<li style="margin:3px 0;font-size:14px;color:#374151;">&#10003; ${escapeHtml(f)}</li>`)
    .join("");

  try {
    return await sendWithResend({
      to: params.coachEmail,
      subject: `Mídias de ${params.studentName} foram removidas automaticamente`,
      text:
        `Olá!\n\nAs mídias da anamnese de ${params.studentName} foram removidas automaticamente em ${dateFormatted}.\n\n` +
        `Arquivos removidos: ${params.filesDeleted.join(", ")}\n\n` +
        `Os dados textuais da anamnese permanecem disponíveis normalmente no painel.\n\nEquipe Sano+`,
      html: tpl(
        "Mídias removidas automaticamente",
        `Anamnese de ${safeName}`,
        p(`Olá! Este é um aviso informativo sobre a política de retenção de mídia da plataforma.`) +
        p(`Os arquivos de mídia da anamnese de <strong style="color:#111827;">${safeName}</strong> foram removidos automaticamente em <strong>${dateFormatted}</strong>, conforme a política de retenção de 48 horas. As fotos posturais também foram enviadas anexadas no e-mail original desta ficha.`) +
        highlight(
          `<p style="margin:0 0 8px;padding:0;font-size:12px;font-weight:700;color:#6B7280;letter-spacing:0.5px;text-transform:uppercase;">Arquivos removidos</p>` +
          `<ul style="margin:0;padding-left:0;list-style:none;">${filesHtml}</ul>`
        ) +
        disclaimerBox(
          "Os dados textuais da anamnese (informações pessoais, objetivos, pontuações FMS e histórico) " +
          "permanecem disponíveis normalmente no painel. Apenas os arquivos de mídia foram removidos do servidor."
        ) +
        cta("Ver anamnese no painel", params.panelLink) +
        signoff()
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar confirmação de deleção de mídia.");
  }
}

export async function sendSubscriptionExpiredEmail(params: {
  email: string;
  studentName: string;
  planName: string;
  renewLink: string;
  coachName?: string | null;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.studentName);
  const safePlan = escapeHtml(params.planName);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Seu acesso ao Sano+ foi suspenso",
      text: `Olá, ${params.studentName}!\n\nSua assinatura do plano ${params.planName} expirou. Seu histórico está salvo.\n\nPara retomar:\n${params.renewLink}\n\nEquipe Sano+`,
      html: tpl(
        "Acesso suspenso",
        "Sua assinatura chegou ao fim",
        p(`Olá, <strong style="color:#111827;">${safeName}</strong>.`) +
        p(`Sua assinatura do plano <strong>${safePlan}</strong> expirou e o acesso ao Sano+ foi suspenso temporariamente. Não se preocupe — seu histórico de treinos está salvo e não vai a lugar nenhum.`) +
        dataLabel("O que acontece ao renovar", "Seu acesso volta imediatamente e retomamos de onde paramos. Sem burocracia.") +
        cta("Renovar minha assinatura", params.renewLink) +
        disclaimerBox("Se tiver alguma dúvida ou quiser conversar antes de renovar, responda este e-mail.") +
        signoff(params.coachName)
      ),
    });
  } catch (error) {
    return catchEmailError(error, "Falha ao enviar e-mail de assinatura expirada.");
  }
}
