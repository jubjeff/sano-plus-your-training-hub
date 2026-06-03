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
} from "../_shared/email.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { getEdgeRuntimeEnv } from "../_shared/env.ts";

type AnamnesisSubmitBody = {
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

  // Deep Squat obrigatório
  if (deepSquatScore === null) throw new EdgeHttpError("invalid_deep_squat_score", "Avaliacao de dificuldade do Deep Squat invalida.", 400);
  if (!deepSquatVideoFrontalUrl) throw new EdgeHttpError("missing_deep_squat_video_frontal", "Video frontal do Deep Squat obrigatorio.", 400);
  if (!deepSquatVideoLateralUrl) throw new EdgeHttpError("missing_deep_squat_video_lateral", "Video lateral do Deep Squat obrigatorio.", 400);
  if (!deepSquatVideoPosteriorUrl) throw new EdgeHttpError("missing_deep_squat_video_posterior", "Video posterior do Deep Squat obrigatorio.", 400);

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
    const input = validateBody(rawBody);

    const serviceRoleClient = createServiceRoleClient();

    const { data: inserted, error: insertError } = await serviceRoleClient
      .from("anamneses")
      .insert({
        teacher_id: input.teacherId ?? null,
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
    };

    const env = getEdgeRuntimeEnv();

    // Resolve o e-mail do professor: prioriza o do DB (via teacherId), cai no secret como fallback
    const coachEmail = await resolveTeacherNotificationEmail(
      serviceRoleClient,
      input.teacherId,
      env.coachNotificationEmail,
    );

    const [welcomeDelivery, notificationDelivery] = await Promise.all([
      sendAnamnesisWelcomeEmail({ fullName: input.fullName, email: input.email }),
      coachEmail
        ? sendAnamnesisCoachNotificationEmail({
            coachEmail,
            data: emailData,
            reviewLink,
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
