import {
  createErrorResponse,
  createOptionsResponse,
  createSuccessResponse,
  EdgeHttpError,
  ensureMethod,
  getRequestId,
  normalizeEdgeError,
  parseJsonBody,
} from "../_shared/http.ts";
import {
  sendAnamnesisWelcomeEmail,
  sendAnamnesisCoachNotificationEmail,
  type AnamnesisEmailData,
  type EmailAttachment,
} from "../_shared/email.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";

type AnamnesisSubmitBody = {
  // "teacher_info" faz leitura publica dos dados de contato do professor.
  // Ausente (ou qualquer outro valor) = submissao normal da anamnese.
  mode?: string | null;
  teacherId?: string | null;
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
};

// Janela de retencao da midia no storage, em horas.
export const MEDIA_RETENTION_HOURS = 48;

const VALID_GOALS = new Set(["hipertrofia", "emagrecimento", "condicionamento", "recomposicao"]);
const VALID_LEVELS = new Set(["iniciante", "intermediario", "avancado"]);
const VALID_DURATIONS = new Set(["30min", "45min", "60min", "90min"]);
const VALID_TIMES = new Set(["manha", "tarde", "noite"]);
const VALID_EQUIPMENT = new Set(["academia_completa", "halteres_casa", "elasticos", "sem_equipamento"]);

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function resolveAppOrigin(request: Request): string {
  const env = getEdgeRuntimeEnv();
  const candidates = [
    env.appUrl,
    request.headers.get("origin"),
    request.headers.get("referer"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.hostname === "localhost") {
        return url.origin;
      }
    } catch {
      // try next
    }
  }

  return "https://sanoplus.online";
}

function normalizeFmsScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 3) return null;
  return n;
}

function calculateFmsTotal(scores: (number | null)[]): number | null {
  if (scores.some((s) => s === null)) return null;
  return (scores as number[]).reduce((sum, s) => sum + s, 0);
}

async function resolveTeacherNotificationEmail(
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  teacherId: string | null | undefined,
  fallback: string | null,
): Promise<string | null> {
  if (!teacherId) return fallback;

  try {
    const { data: teacher } = await serviceRoleClient
      .from("teachers")
      .select("user_id")
      .eq("id", teacherId)
      .maybeSingle();

    if (!teacher?.user_id) return fallback;

    const { data: profile } = await serviceRoleClient
      .from("profiles")
      .select("email")
      .eq("id", teacher.user_id)
      .maybeSingle();

    return (profile?.email as string | null) ?? fallback;
  } catch {
    return fallback;
  }
}

// Baixa as fotos posturais do storage e devolve em base64 para irem anexadas.
// Motivo: o e-mail referencia as fotos por URL publica, e a midia e purgada do
// storage poucas horas depois — sem o anexo, o professor fica com um e-mail de
// imagens quebradas. Falha em qualquer foto nao derruba o envio.
async function buildPhotoAttachments(urls: (string | null)[]): Promise<EmailAttachment[]> {
  const labels = ["frontal", "lateral", "posterior"];
  const attachments: EmailAttachment[] = [];

  await Promise.all(
    urls.map(async (url, index) => {
      if (!url) return;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`[anamnesis-submit] foto ${labels[index]} respondeu ${response.status}; anexo ignorado.`);
          return;
        }

        const buffer = new Uint8Array(await response.arrayBuffer());
        let binary = "";
        for (let i = 0; i < buffer.length; i += 8192) {
          binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
        }

        const contentType = response.headers.get("content-type") ?? "image/webp";
        const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";

        attachments[index] = {
          filename: `foto-${labels[index]}.${extension}`,
          content: btoa(binary),
          contentType,
        };
      } catch (error) {
        console.warn(`[anamnesis-submit] falha ao anexar foto ${labels[index]}:`, error);
      }
    }),
  );

  return attachments.filter(Boolean);
}

function validateBody(body: AnamnesisSubmitBody) {
  const teacherId = normalizeString(body.teacherId) || null;
  const fullName = normalizeString(body.fullName);
  const email = normalizeEmail(body.email);
  const phone = normalizeString(body.phone).replace(/\D/g, "");
  const age = Number(body.age);
  const weightKg = Number(body.weightKg);
  const goal = normalizeString(body.goal);
  const experienceLevel = normalizeString(body.experienceLevel);
  const availableDaysPerWeek = Number(body.availableDaysPerWeek);
  const sessionDuration = normalizeString(body.sessionDuration);
  const preferredTime = normalizeString(body.preferredTime);
  const availableEquipment = Array.isArray(body.availableEquipment) ? body.availableEquipment : [];
  const injuryHistory = normalizeString(body.injuryHistory) || "nenhuma";
  const hasTrainedBefore = Boolean(body.hasTrainedBefore);
  const stoppedTrainingDuration = hasTrainedBefore
    ? normalizeString(body.stoppedTrainingDuration) || null
    : null;

  // Fotos
  const fotoFrontalUrl = normalizeString(body.fotoFrontalUrl) || null;
  const fotoLateralUrl = normalizeString(body.fotoLateralUrl) || null;
  const fotoPosteriorUrl = normalizeString(body.fotoPosteriorUrl) || null;

  // Deep Squat
  const deepSquatScore = normalizeFmsScore(body.deepSquatScore);
  const deepSquatObs = normalizeString(body.deepSquatObs) || null;
  const deepSquatVideoFrontalUrl = normalizeString(body.deepSquatVideoFrontalUrl) || null;
  const deepSquatVideoLateralUrl = normalizeString(body.deepSquatVideoLateralUrl) || null;
  const deepSquatVideoPosteriorUrl = normalizeString(body.deepSquatVideoPosteriorUrl) || null;

  // Score total: apenas deep squat
  const fmsScoreTotal = deepSquatScore;

  if (fullName.length < 3) throw new EdgeHttpError("invalid_full_name", "Nome completo invalido.", 400);
  if (!email.includes("@") || !email.includes(".")) throw new EdgeHttpError("invalid_email", "E-mail invalido.", 400);
  if (phone.length < 10 || phone.length > 13) throw new EdgeHttpError("invalid_phone", "Telefone invalido.", 400);
  if (!Number.isInteger(age) || age < 10 || age > 100) throw new EdgeHttpError("invalid_age", "Idade invalida.", 400);
  if (isNaN(weightKg) || weightKg <= 0 || weightKg >= 500) throw new EdgeHttpError("invalid_weight", "Peso invalido.", 400);
  if (!VALID_GOALS.has(goal)) throw new EdgeHttpError("invalid_goal", "Objetivo invalido.", 400);
  if (!VALID_LEVELS.has(experienceLevel)) throw new EdgeHttpError("invalid_experience_level", "Nivel invalido.", 400);
  if (!Number.isInteger(availableDaysPerWeek) || availableDaysPerWeek < 1 || availableDaysPerWeek > 7) throw new EdgeHttpError("invalid_days", "Dias por semana invalido.", 400);
  if (!VALID_DURATIONS.has(sessionDuration)) throw new EdgeHttpError("invalid_session_duration", "Duracao invalida.", 400);
  if (!VALID_TIMES.has(preferredTime)) throw new EdgeHttpError("invalid_preferred_time", "Horario invalido.", 400);
  if (availableEquipment.length === 0 || !availableEquipment.every((e) => VALID_EQUIPMENT.has(e))) throw new EdgeHttpError("invalid_equipment", "Equipamento invalido.", 400);
  if (injuryHistory.length === 0) throw new EdgeHttpError("invalid_injury_history", "Lesoes/limitacoes obrigatorias.", 400);

  // Fotos obrigatórias
  if (!fotoFrontalUrl) throw new EdgeHttpError("missing_foto_frontal", "Foto frontal obrigatoria.", 400);
  if (!fotoLateralUrl) throw new EdgeHttpError("missing_foto_lateral", "Foto lateral obrigatoria.", 400);
  if (!fotoPosteriorUrl) throw new EdgeHttpError("missing_foto_posterior", "Foto posterior obrigatoria.", 400);

  // Deep Squat: o score continua obrigatorio, os videos nao.
  // Os videos deixaram de ser enviados pelo formulario e vao pelo WhatsApp do
  // professor (3 arquivos de ate 15 MB nao trafegam por e-mail e eram 98% do
  // consumo de storage). Os campos deep_squat_video_*_url seguem existindo na
  // tabela e no corpo da requisicao para nao quebrar registros antigos, mas
  // chegam nulos e nao podem mais bloquear o envio.
  if (deepSquatScore === null) throw new EdgeHttpError("invalid_deep_squat_score", "Avaliacao de dificuldade do Deep Squat invalida.", 400);

  return {
    teacherId,
    fullName, email, phone, age, weightKg, goal, experienceLevel,
    availableDaysPerWeek, sessionDuration, preferredTime, availableEquipment,
    injuryHistory, hasTrainedBefore, stoppedTrainingDuration,
    fotoFrontalUrl, fotoLateralUrl, fotoPosteriorUrl,
    deepSquatScore, deepSquatObs,
    deepSquatVideoFrontalUrl, deepSquatVideoLateralUrl, deepSquatVideoPosteriorUrl,
    fmsScoreTotal,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return createOptionsResponse();

  const requestId = getRequestId(request);

  try {
    ensureMethod(request, ["POST"]);
    const rawBody = await parseJsonBody<AnamnesisSubmitBody>(request);

    // Modo de leitura publica: a tela de anamnese precisa do nome e do WhatsApp
    // do professor para montar o CTA de envio dos videos. `teachers` tem RLS
    // `teachers_select_own`, entao o anon key nao consegue ler direto — por isso
    // passa por aqui, com service role, devolvendo apenas campos publicos.
    if (rawBody.mode === "teacher_info") {
      const teacherId = normalizeString(rawBody.teacherId);
      if (!teacherId) throw new EdgeHttpError("missing_params", "teacherId e obrigatorio.", 400);

      const db = createServiceRoleClient();
      const { data: teacher } = await db
        .from("teachers")
        .select("id, user_id, whatsapp")
        .or(`id.eq.${teacherId},user_id.eq.${teacherId}`)
        .maybeSingle();

      if (!teacher) throw new EdgeHttpError("teacher_not_found", "Professor nao encontrado.", 404);

      let coachName: string | null = null;
      if (teacher.user_id) {
        const { data: profile } = await db.from("profiles").select("full_name").eq("id", teacher.user_id).maybeSingle();
        coachName = (profile?.full_name as string | null) ?? null;
      }

      return createSuccessResponse(requestId, {
        coachName,
        whatsapp: (teacher.whatsapp as string | null) ?? null,
      });
    }

    const input = validateBody(rawBody);

    const serviceRoleClient = createServiceRoleClient();

    // Resolve teacher_id: aceita tanto teachers.id quanto auth user_id (user.id)
    let resolvedTeacherId: string | null = null;
    if (input.teacherId) {
      // Tenta por id direto (teachers.id)
      const { data: byId } = await serviceRoleClient
        .from("teachers")
        .select("id")
        .eq("id", input.teacherId)
        .maybeSingle();

      if (byId?.id) {
        resolvedTeacherId = byId.id as string;
      } else {
        // Fallback: tenta por user_id (auth UID)
        const { data: byUserId } = await serviceRoleClient
          .from("teachers")
          .select("id")
          .eq("user_id", input.teacherId)
          .maybeSingle();
        resolvedTeacherId = (byUserId?.id as string | null) ?? null;
      }
    }

    const now = new Date();
    // 48h em vez de 7 dias: as fotos agora vao anexadas no e-mail do professor,
    // entao o storage e so um buffer para a visualizacao no painel. Prazo curto
    // porque o plano Free tem 1 GB e ja estourou uma vez por acumulo de midia.
    const mediaExpiresAt = new Date(now.getTime() + MEDIA_RETENTION_HOURS * 60 * 60 * 1000).toISOString();

    const { data: inserted, error: insertError } = await serviceRoleClient
      .from("anamneses")
      .insert({
        teacher_id: resolvedTeacherId,
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        age: input.age,
        weight_kg: input.weightKg,
        goal: input.goal,
        experience_level: input.experienceLevel,
        available_days_per_week: input.availableDaysPerWeek,
        session_duration: input.sessionDuration,
        preferred_time: input.preferredTime,
        available_equipment: input.availableEquipment,
        injury_history: input.injuryHistory,
        has_trained_before: input.hasTrainedBefore,
        stopped_training_duration: input.stoppedTrainingDuration ?? null,
        foto_frontal_url: input.fotoFrontalUrl,
        foto_lateral_url: input.fotoLateralUrl,
        foto_posterior_url: input.fotoPosteriorUrl,
        deep_squat_score: input.deepSquatScore,
        deep_squat_obs: input.deepSquatObs,
        deep_squat_video_frontal_url: input.deepSquatVideoFrontalUrl,
        deep_squat_video_lateral_url: input.deepSquatVideoLateralUrl,
        deep_squat_video_posterior_url: input.deepSquatVideoPosteriorUrl,
        fms_score_total: input.fmsScoreTotal,
        status: "pending_review",
        media_expires_at: mediaExpiresAt,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted?.id) {
      throw new EdgeHttpError(
        "anamnesis_insert_failed",
        insertError?.message ?? "Nao foi possivel salvar sua anamnese. Tente novamente.",
        500,
      );
    }

    const anamnesisId = inserted.id as string;
    const appOrigin = resolveAppOrigin(request);
    const reviewLink = `${appOrigin}/anamneses`;

    const emailData: AnamnesisEmailData = {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      age: input.age,
      weightKg: input.weightKg,
      goal: input.goal,
      experienceLevel: input.experienceLevel,
      availableDaysPerWeek: input.availableDaysPerWeek,
      sessionDuration: input.sessionDuration,
      preferredTime: input.preferredTime,
      availableEquipment: input.availableEquipment,
      injuryHistory: input.injuryHistory,
      hasTrainedBefore: input.hasTrainedBefore,
      stoppedTrainingDuration: input.stoppedTrainingDuration,
      fotoFrontalUrl: input.fotoFrontalUrl,
      fotoLateralUrl: input.fotoLateralUrl,
      fotoPosteriorUrl: input.fotoPosteriorUrl,
      deepSquatScore: input.deepSquatScore,
      deepSquatObs: input.deepSquatObs,
      deepSquatVideoFrontalUrl: input.deepSquatVideoFrontalUrl,
      deepSquatVideoLateralUrl: input.deepSquatVideoLateralUrl,
      deepSquatVideoPosteriorUrl: input.deepSquatVideoPosteriorUrl,
      fmsScoreTotal: input.fmsScoreTotal,
      mediaExpiresAt,
    };

    const env = getEdgeRuntimeEnv();

    // Resolve o e-mail do professor usando o ID já validado
    const coachEmail = await resolveTeacherNotificationEmail(
      serviceRoleClient,
      resolvedTeacherId,
      env.coachNotificationEmail,
    );

    const photoAttachments = coachEmail
      ? await buildPhotoAttachments([input.fotoFrontalUrl, input.fotoLateralUrl, input.fotoPosteriorUrl])
      : [];

    const [welcomeDelivery, notificationDelivery] = await Promise.all([
      sendAnamnesisWelcomeEmail({ fullName: input.fullName, email: input.email }),
      coachEmail
        ? sendAnamnesisCoachNotificationEmail({
            coachEmail,
            data: emailData,
            reviewLink,
            attachments: photoAttachments,
          })
        : Promise.resolve({ status: "skipped" as const, provider: "none" as const, message: "Nenhum e-mail de professor configurado." }),
    ]);

    return createSuccessResponse(requestId, {
      anamnesisId,
      studentEmail: input.email,
      fmsScoreTotal: input.fmsScoreTotal,
      emailDelivery: { welcome: welcomeDelivery, coachNotification: notificationDelivery },
    });
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
