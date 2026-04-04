import { Exercise } from "@/types";
import { ExerciseDbApiExercise, SanoExerciseCatalogItem } from "@/types/exercisedb";

function titleCase(value?: string | null) {
  if (!value) return null;
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function summarizeExerciseDbInstructions(instructions?: string[], fallbackName?: string) {
  const joined = (instructions ?? []).filter(Boolean).join(" ");
  if (joined) return joined.length > 180 ? `${joined.slice(0, 180).trim()}...` : joined;
  return fallbackName ? `${fallbackName} com foco em execução controlada e boa mecânica.` : "";
}

export function mapExerciseDbToCatalogItem(exercise: ExerciseDbApiExercise): SanoExerciseCatalogItem {
  const bodyPart = titleCase(exercise.bodyPart);
  const target = titleCase(exercise.target);
  const equipment = titleCase(exercise.equipment);
  const secondaryMuscles = (exercise.secondaryMuscles ?? []).map((item) => titleCase(item) ?? item);
  const instructions = (exercise.instructions ?? []).filter(Boolean).join(" ");

  return {
    source: "exercisedb",
    externalId: String(exercise.id),
    name: exercise.name,
    instructions,
    summary: summarizeExerciseDbInstructions(exercise.instructions, exercise.name),
    muscles: [target].filter((item): item is string => Boolean(item)),
    equipment: [equipment].filter((item): item is string => Boolean(item)),
    category: bodyPart,
    bodyPart,
    target,
    secondaryMuscles,
    imageUrl: exercise.gifUrl ?? null,
    mediaUrls: exercise.gifUrl ? [exercise.gifUrl] : [],
    metadata: {
      exerciseDbId: exercise.id,
      bodyPart: exercise.bodyPart,
      target: exercise.target,
      equipment: exercise.equipment,
    },
  };
}

export function mapCatalogItemToExercise(item: SanoExerciseCatalogItem): Exercise {
  return {
    id: Math.random().toString(36).substring(2, 10),
    name: item.name,
    sets: 3,
    reps: "12",
    load: "",
    rest: "60s",
    notes: "",
    source: item.source,
    externalId: item.externalId,
    instructions: item.instructions,
    summary: item.summary,
    muscles: item.muscles,
    equipment: item.equipment,
    category: item.category,
    bodyPart: item.bodyPart,
    target: item.target,
    secondaryMuscles: item.secondaryMuscles,
    imageUrl: item.imageUrl,
    mediaUrls: item.mediaUrls,
    metadata: item.metadata,
  };
}
