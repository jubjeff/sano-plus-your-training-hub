import { getEdgeRuntimeEnv } from "./env.ts";
import { EdgeHttpError } from "./http.ts";

type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailDeliveryResult = {
  status: "sent" | "skipped" | "failed";
  provider: "resend" | "none";
  message: string;
  details?: string | null;
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
      "A conta foi criada, mas o envio do e-mail com a senha provisoria falhou.",
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
  accessLink: string;
  temporaryPassword: string;
}) {
  const safeStudentName = escapeHtml(params.studentName);
  const safeEmail = escapeHtml(params.email);
  const safeAccessLink = escapeHtml(params.accessLink);
  const safePassword = escapeHtml(params.temporaryPassword);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Seu acesso inicial ao Sano+",
      text:
        `Ola, ${params.studentName}.\n\n` +
        `Seu acesso inicial ao Sano+ foi criado.\n` +
        `Link de acesso: ${params.accessLink}\n` +
        `E-mail: ${params.email}\n` +
        `Senha provisoria: ${params.temporaryPassword}\n\n` +
        `No primeiro acesso, sera obrigatorio criar uma nova senha.\n`,
      html:
        `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">` +
        `<h2 style="margin-bottom:16px">Seu acesso inicial ao Sano+</h2>` +
        `<p>Ola, <strong>${safeStudentName}</strong>.</p>` +
        `<p>Seu acesso inicial ao Sano+ foi criado com sucesso.</p>` +
        `<div style="margin:20px 0;padding:16px;border:1px solid #dbe4f0;border-radius:12px;background:#f8fafc">` +
        `<p style="margin:0 0 8px 0"><strong>Link de acesso:</strong> <a href="${safeAccessLink}">${safeAccessLink}</a></p>` +
        `<p style="margin:0 0 8px 0"><strong>E-mail:</strong> ${safeEmail}</p>` +
        `<p style="margin:0"><strong>Senha provisoria:</strong> <span style="font-family:monospace">${safePassword}</span></p>` +
        `</div>` +
        `<p>No primeiro acesso, sera obrigatorio criar uma nova senha antes de entrar na plataforma.</p>` +
        `</div>`,
    });
  } catch (error) {
    const details = error instanceof EdgeHttpError ? error.details : null;
    const responseStatus =
      details && typeof details === "object" && "responseStatus" in details ? String(details.responseStatus ?? "") : null;
    const responseBody =
      details && typeof details === "object" && "responseBody" in details ? String(details.responseBody ?? "") : null;

    return {
      status: "failed",
      provider: "resend",
      message: "A conta foi criada, mas o envio do e-mail falhou.",
      details: [responseStatus, responseBody].filter(Boolean).join(" - ") || (error instanceof Error ? error.message : null),
    };
  }
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

const GOAL_LABELS: Record<string, string> = {
  hipertrofia: "Hipertrofia",
  emagrecimento: "Emagrecimento",
  condicionamento: "Condicionamento",
  recomposicao: "Recomposicao corporal",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediario",
  avancado: "Avancado",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  "academia_completa": "Academia completa",
  "halteres_casa": "Halteres em casa",
  "elasticos": "Elasticos",
  "sem_equipamento": "Sem equipamento",
};

const TIME_LABELS: Record<string, string> = {
  manha: "Manha",
  tarde: "Tarde",
  noite: "Noite",
};

function formatEquipmentList(equipment: string[]): string {
  if (!equipment || equipment.length === 0) return "Nao informado";
  return equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(", ");
}

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
  // Fotos posturais
  fotoFrontalUrl?: string | null;
  fotoLateralUrl?: string | null;
  fotoPosteriorUrl?: string | null;
  // Deep Squat
  deepSquatScore?: number | null;
  deepSquatObs?: string | null;
  deepSquatVideoFrontalUrl?: string | null;
  deepSquatVideoLateralUrl?: string | null;
  deepSquatVideoPosteriorUrl?: string | null;
  fmsScoreTotal?: number | null;
};

export async function sendAnamnesisWelcomeEmail(params: {
  fullName: string;
  email: string;
}): Promise<EmailDeliveryResult> {
  const safeName = escapeHtml(params.fullName);

  try {
    return await sendWithResend({
      to: params.email,
      subject: "Anamnese recebida — Sano+",
      text:
        `Ola, ${params.fullName}!\n\n` +
        `Recebemos sua anamnese com sucesso. Nossa equipe vai analisar seus dados e em ate 48 horas voce recebera seu acesso e treino personalizado.\n\n` +
        `Fique de olho no seu e-mail.\n\n` +
        `Equipe Sano+`,
      html:
        `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:600px">` +
        `<h2 style="margin-bottom:8px;color:#10b981">Anamnese recebida com sucesso!</h2>` +
        `<p>Ola, <strong>${safeName}</strong>!</p>` +
        `<p>Recebemos sua anamnese e ja estamos analisando seus dados. Em ate <strong>48 horas</strong> voce recebera seu acesso e treino personalizado aqui neste e-mail.</p>` +
        `<div style="margin:24px 0;padding:16px;border-left:4px solid #10b981;background:#f0fdf4;border-radius:0 12px 12px 0">` +
        `<p style="margin:0;font-weight:600;color:#065f46">Proximos passos</p>` +
        `<p style="margin:8px 0 0;color:#047857;font-size:14px">1. Analisamos seu perfil e objetivos<br>2. Montamos seu treino personalizado<br>3. Voce recebe tudo por e-mail para comecar</p>` +
        `</div>` +
        `<p style="font-size:14px;color:#475569">Qualquer duvida, responda este e-mail. Estamos aqui para ajudar.</p>` +
        `<p style="margin-top:24px;font-size:14px;color:#0f172a"><strong>Equipe Sano+</strong></p>` +
        `</div>`,
    });
  } catch (error) {
    return {
      status: "failed",
      provider: "resend",
      message: "Falha ao enviar e-mail de boas-vindas.",
      details: error instanceof Error ? error.message : null,
    };
  }
}

export async function sendAnamnesisCoachNotificationEmail(params: {
  coachEmail: string;
  coachName?: string | null;
  data: AnamnesisEmailData;
  reviewLink: string;
}): Promise<EmailDeliveryResult> {
  const d = params.data;
  const safeName = escapeHtml(d.fullName);
  const safeEmail = escapeHtml(d.email);
  const safePhone = escapeHtml(d.phone);
  const safeInjury = escapeHtml(d.injuryHistory);
  const safeLink = escapeHtml(params.reviewLink);
  const goalLabel = GOAL_LABELS[d.goal] ?? d.goal;
  const expLabel = EXPERIENCE_LABELS[d.experienceLevel] ?? d.experienceLevel;
  const timeLabel = TIME_LABELS[d.preferredTime] ?? d.preferredTime;
  const equipmentList = formatEquipmentList(d.availableEquipment);
  const trainedBefore = d.hasTrainedBefore
    ? `Sim${d.stoppedTrainingDuration ? ` (parou ha ${escapeHtml(d.stoppedTrainingDuration)})` : ""}`
    : "Nao";

  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;font-size:14px;color:#64748b;white-space:nowrap">${label}</td>` +
    `<td style="padding:8px 12px;font-size:14px;color:#0f172a;font-weight:500">${value}</td></tr>`;

  try {
    return await sendWithResend({
      to: params.coachEmail,
      subject: `Nova anamnese recebida — ${d.fullName}`,
      text:
        `Nova anamnese recebida!\n\n` +
        `Aluno: ${d.fullName}\n` +
        `E-mail: ${d.email}\n` +
        `Telefone: ${d.phone}\n` +
        `Idade: ${d.age} anos | Peso: ${d.weightKg} kg\n` +
        `Objetivo: ${goalLabel} | Nivel: ${expLabel}\n` +
        `Dias/semana: ${d.availableDaysPerWeek} | Duracao: ${d.sessionDuration} | Horario: ${timeLabel}\n` +
        `Equipamentos: ${equipmentList}\n` +
        `Ja treinou: ${trainedBefore}\n` +
        `Lesoes/limitacoes: ${d.injuryHistory}\n\n` +
        `Revise no painel: ${params.reviewLink}\n`,
      html:
        `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:600px">` +
        `<h2 style="margin-bottom:4px;color:#0f172a">Nova anamnese recebida</h2>` +
        `<p style="margin:0 0 20px;color:#475569;font-size:14px">Um novo aluno preencheu o formulario de anamnese.</p>` +
        `<table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">` +
        `<thead><tr style="background:#f8fafc"><th colspan="2" style="padding:10px 12px;text-align:left;font-size:13px;font-weight:700;color:#0f172a;letter-spacing:0.05em">DADOS DO ALUNO</th></tr></thead>` +
        `<tbody>` +
        row("Nome", safeName) +
        row("E-mail", safeEmail) +
        row("Telefone", safePhone) +
        row("Idade", `${d.age} anos`) +
        row("Peso atual", `${d.weightKg} kg`) +
        `<tr style="background:#f8fafc"><td colspan="2" style="padding:8px 12px;font-size:13px;font-weight:700;color:#0f172a;letter-spacing:0.05em">PERFIL DE TREINO</td></tr>` +
        row("Objetivo", goalLabel) +
        row("Nivel", expLabel) +
        row("Dias/semana", `${d.availableDaysPerWeek} dias`) +
        row("Duracao da sessao", d.sessionDuration) +
        row("Horario preferido", timeLabel) +
        row("Equipamentos", equipmentList) +
        row("Ja treinou antes?", trainedBefore) +
        row("Lesoes/limitacoes", safeInjury) +
        (d.deepSquatScore !== null && d.deepSquatScore !== undefined
          ? `<tr style="background:#f8fafc"><td colspan="2" style="padding:8px 12px;font-size:13px;font-weight:700;color:#0f172a;letter-spacing:0.05em">TESTES FUNCIONAIS</td></tr>` +
            row("Deep Squat (dificuldade)", `${d.deepSquatScore}/3`) +
            (d.deepSquatObs ? row("Obs. Deep Squat", escapeHtml(d.deepSquatObs)) : "") +
            row("Score total", d.fmsScoreTotal !== null && d.fmsScoreTotal !== undefined ? String(d.fmsScoreTotal) : "—")
          : "") +
        (d.deepSquatVideoFrontalUrl || d.deepSquatVideoLateralUrl || d.deepSquatVideoPosteriorUrl
          ? `<div style="margin:16px 0">` +
            `<p style="font-weight:700;font-size:13px;letter-spacing:0.05em;margin:0 0 8px">VÍDEOS DEEP SQUAT</p>` +
            `<div style="display:flex;gap:10px;flex-wrap:wrap">` +
            (d.deepSquatVideoFrontalUrl ? `<a href="${escapeHtml(d.deepSquatVideoFrontalUrl)}" target="_blank" style="display:inline-block;padding:8px 14px;border-radius:8px;background:#10b981;color:#fff;text-decoration:none;font-size:13px;font-weight:600">▶ Frontal</a>` : "") +
            (d.deepSquatVideoLateralUrl ? `<a href="${escapeHtml(d.deepSquatVideoLateralUrl)}" target="_blank" style="display:inline-block;padding:8px 14px;border-radius:8px;background:#10b981;color:#fff;text-decoration:none;font-size:13px;font-weight:600">▶ Lateral</a>` : "") +
            (d.deepSquatVideoPosteriorUrl ? `<a href="${escapeHtml(d.deepSquatVideoPosteriorUrl)}" target="_blank" style="display:inline-block;padding:8px 14px;border-radius:8px;background:#10b981;color:#fff;text-decoration:none;font-size:13px;font-weight:600">▶ Posterior</a>` : "") +
            `</div></div>`
          : "") +
        `</tbody></table>` +
        (d.fotoFrontalUrl || d.fotoLateralUrl || d.fotoPosteriorUrl
          ? `<div style="margin:20px 0">` +
            `<p style="font-weight:700;font-size:13px;letter-spacing:0.05em;margin:0 0 10px">FOTOS POSTURAIS</p>` +
            `<div style="display:flex;gap:12px;flex-wrap:wrap">` +
            (d.fotoFrontalUrl ? `<div style="text-align:center"><a href="${escapeHtml(d.fotoFrontalUrl)}" target="_blank"><img src="${escapeHtml(d.fotoFrontalUrl)}" alt="Frontal" style="width:160px;height:200px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0"/></a><p style="font-size:12px;color:#64748b;margin:4px 0 0">Frontal</p></div>` : "") +
            (d.fotoLateralUrl ? `<div style="text-align:center"><a href="${escapeHtml(d.fotoLateralUrl)}" target="_blank"><img src="${escapeHtml(d.fotoLateralUrl)}" alt="Lateral" style="width:160px;height:200px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0"/></a><p style="font-size:12px;color:#64748b;margin:4px 0 0">Lateral</p></div>` : "") +
            (d.fotoPosteriorUrl ? `<div style="text-align:center"><a href="${escapeHtml(d.fotoPosteriorUrl)}" target="_blank"><img src="${escapeHtml(d.fotoPosteriorUrl)}" alt="Posterior" style="width:160px;height:200px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0"/></a><p style="font-size:12px;color:#64748b;margin:4px 0 0">Posterior</p></div>` : "") +
            `</div></div>`
          : "") +
        `<p style="margin:24px 0 8px">` +
        `<a href="${safeLink}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#10b981;color:#fff;text-decoration:none;font-weight:700;font-size:14px">Ver no painel de anamneses</a>` +
        `</p>` +
        `</div>`,
    });
  } catch (error) {
    return {
      status: "failed",
      provider: "resend",
      message: "Falha ao enviar notificacao ao coach.",
      details: error instanceof Error ? error.message : null,
    };
  }
}
