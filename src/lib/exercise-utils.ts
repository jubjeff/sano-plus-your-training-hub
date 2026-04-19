import type { Exercise, ExerciseLibraryItem } from "@/types";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function now() {
  return new Date().toISOString();
}

export function slugifyExerciseName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function createEmptyExerciseLibraryItem(): ExerciseLibraryItem {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    slug: "",
    category: "Musculação",
    muscleCategory: null,
    muscleGroupPrimary: null,
    muscleGroupsSecondary: [],
    movementType: null,
    bodyRegion: null,
    equipment: "",
    difficultyLevel: "Iniciante",
    exerciseType: "Hipertrofia",
    description: "",
    executionInstructions: "",
    breathingTips: "",
    postureTips: "",
    contraindications: "",
    commonMistakes: "",
    videoUrl: null,
    videoStoragePath: null,
    thumbnailUrl: null,
    thumbnailStoragePath: null,
    durationLimitSeconds: 6,
    isActive: true,
    isGlobal: true,
    createdBy: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createExerciseAssignmentFromLibrary(exercise: ExerciseLibraryItem): Exercise {
  const timestamp = now();
  return {
    id: generateId(),
    libraryExerciseId: exercise.id,
    name: exercise.name,
    slug: exercise.slug,
    category: exercise.category,
    description: exercise.description,
    executionInstructions: exercise.executionInstructions,
    breathingTips: exercise.breathingTips,
    postureTips: exercise.postureTips,
    contraindications: exercise.contraindications,
    commonMistakes: exercise.commonMistakes,
    sets: 3,
    reps: "10-12",
    load: "",
    studentLoad: null,
    rest: "60s",
    notes: "",
    bodyRegion: exercise.bodyRegion,
    movementType: exercise.movementType,
    difficultyLevel: exercise.difficultyLevel,
    exerciseType: exercise.exerciseType,
    equipment: exercise.equipment,
    muscleCategory: exercise.muscleCategory,
    muscleGroupPrimary: exercise.muscleGroupPrimary,
    muscleGroupsSecondary: [...exercise.muscleGroupsSecondary],
    videoUrl: exercise.videoUrl ?? null,
    videoStoragePath: exercise.videoStoragePath ?? null,
    thumbnailUrl: exercise.thumbnailUrl ?? null,
    thumbnailStoragePath: exercise.thumbnailStoragePath ?? null,
    durationLimitSeconds: exercise.durationLimitSeconds ?? 6,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function stampExerciseLibraryUpdate(exercise: ExerciseLibraryItem): ExerciseLibraryItem {
  return {
    ...exercise,
    slug: slugifyExerciseName(exercise.slug || exercise.name),
    updatedAt: now(),
    createdAt: exercise.createdAt ?? now(),
  };
}

export function stampExerciseUpdate(exercise: Exercise): Exercise {
  return {
    ...exercise,
    updatedAt: now(),
    createdAt: exercise.createdAt ?? now(),
  };
}

export function resolveExerciseFromLibrary(
  exercise: Exercise,
  libraryMap?: Map<string, ExerciseLibraryItem>,
): Exercise {
  const libraryItem = exercise.libraryExerciseId ? libraryMap?.get(exercise.libraryExerciseId) : undefined;
  if (!libraryItem) {
    return {
      ...exercise,
      muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])],
    };
  }

  return {
    ...exercise,
    name: libraryItem.name,
    slug: libraryItem.slug,
    category: libraryItem.category,
    description: libraryItem.description,
    executionInstructions: libraryItem.executionInstructions,
    breathingTips: libraryItem.breathingTips,
    postureTips: libraryItem.postureTips,
    contraindications: libraryItem.contraindications,
    commonMistakes: libraryItem.commonMistakes,
    bodyRegion: libraryItem.bodyRegion,
    movementType: libraryItem.movementType,
    difficultyLevel: libraryItem.difficultyLevel,
    exerciseType: libraryItem.exerciseType,
    equipment: libraryItem.equipment,
    muscleCategory: libraryItem.muscleCategory,
    muscleGroupPrimary: libraryItem.muscleGroupPrimary,
    muscleGroupsSecondary: [...libraryItem.muscleGroupsSecondary],
    videoUrl: libraryItem.videoUrl ?? exercise.videoUrl ?? null,
    videoStoragePath: libraryItem.videoStoragePath ?? exercise.videoStoragePath ?? null,
    thumbnailUrl: libraryItem.thumbnailUrl ?? exercise.thumbnailUrl ?? null,
    thumbnailStoragePath: libraryItem.thumbnailStoragePath ?? exercise.thumbnailStoragePath ?? null,
    durationLimitSeconds: libraryItem.durationLimitSeconds ?? exercise.durationLimitSeconds ?? 6,
  };
}

export function getExerciseDescription(exercise: Pick<Exercise, "description" | "executionInstructions">) {
  return exercise.description?.trim() || exercise.executionInstructions?.trim() || "";
}

export function matchesExerciseQuery(exercise: ExerciseLibraryItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    exercise.name,
    exercise.description,
    exercise.executionInstructions,
    exercise.muscleCategory,
    exercise.muscleGroupPrimary,
    exercise.equipment,
    exercise.movementType,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}
