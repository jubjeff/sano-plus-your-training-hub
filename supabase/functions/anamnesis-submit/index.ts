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

function validateBody(body: AnamnesisSubmitBody): AnamnesisSubmitBody {
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

  if (fullName.length < 3) {
    throw new EdgeHttpError("invalid_full_name", "Nome completo invalido.", 400);
  }
  if (!email.includes("@") || !email.includes(".")) {
    throw new EdgeHttpError("invalid_email", "E-mail invalido.", 400);
  }
  if (phone.length < 10 || phone.length > 13) {
    throw new EdgeHttpError("invalid_phone", "Telefone invalido. Informe DDD + numero.", 400);
  }
  if (!Number.isInteger(age) || age < 10 || age > 100) {
    throw new EdgeHttpError("invalid_age", "Idade deve ser entre 10 e 100 anos.", 400);
  }
  if (isNaN(weightKg) || weightKg <= 0 || weightKg >= 500) {
    throw new EdgeHttpError("invalid_weight", "Peso invalido.", 400);
  }
  if (!VALID_GOALS.has(goal)) {
    throw new EdgeHttpError("invalid_goal", "Objetivo invalido.", 400);
  }
  if (!VALID_LEVELS.has(experienceLevel)) {
    throw new EdgeHttpError("invalid_experience_level", "Nivel de experiencia invalido.", 400);
  }
  if (!Number.isInteger(availableDaysPerWeek) || availableDaysPerWeek < 1 || availableDaysPerWeek > 7) {
    throw new EdgeHttpError("invalid_days", "Dias por semana deve ser entre 1 e 7.", 400);
  }
  if (!VALID_DURATIONS.has(sessionDuration)) {
    throw new EdgeHttpError("invalid_session_duration", "Duracao de sessao invalida.", 400);
  }
  if (!VALID_TIMES.has(preferredTime)) {
    throw new EdgeHttpError("invalid_preferred_time", "Horario preferido invalido.", 400);
  }
  if (availableEquipment.length === 0 || !availableEquipment.every((e) => VALID_EQUIPMENT.has(e))) {
    throw new EdgeHttpError("invalid_equipment", "Selecione ao menos um equipamento valido.", 400);
  }
  if (injuryHistory.length === 0) {
    throw new EdgeHttpError("invalid_injury_history", "Informe historico de lesoes (ou 'nenhuma').", 400);
  }

  return {
    fullName,
    email,
    phone,
    age,
    weightKg,
    goal,
    experienceLevel,
    availableDaysPerWeek,
    sessionDuration,
    preferredTime,
    availableEquipment,
    injuryHistory,
    hasTrainedBefore,
    stoppedTrainingDuration,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return createOptionsResponse();
  }

  const requestId = getRequestId(request);

  try {
    ensureMethod(request, ["POST"]);
    const rawBody = await parseJsonBody<AnamnesisSubmitBody>(request);
    const input = validateBody(rawBody);

    const serviceRoleClient = createServiceRoleClient();

    const { data: inserted, error: insertError } = await serviceRoleClient
      .from("anamneses")
      .insert({
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
    };

    const env = getEdgeRuntimeEnv();

    const [welcomeDelivery, notificationDelivery] = await Promise.all([
      sendAnamnesisWelcomeEmail({ fullName: input.fullName, email: input.email }),
      env.coachNotificationEmail
        ? sendAnamnesisCoachNotificationEmail({
            coachEmail: env.coachNotificationEmail,
            data: emailData,
            reviewLink,
          })
        : Promise.resolve({ status: "skipped" as const, provider: "none" as const, message: "COACH_NOTIFICATION_EMAIL nao configurado." }),
    ]);

    return createSuccessResponse(requestId, {
      anamnesisId,
      studentEmail: input.email,
      emailDelivery: {
        welcome: welcomeDelivery,
        coachNotification: notificationDelivery,
      },
    });
  } catch (error) {
    return createErrorResponse(requestId, normalizeEdgeError(error));
  }
});
