import type { ExerciseLibraryItem } from "@/types";
import { EXERCISE_LIBRARY_CATALOG, createExerciseSeedFromCatalog } from "@/lib/exercise-catalog";
import { slugifyExerciseName } from "@/lib/exercise-utils";

const createdAt = "2026-04-19T00:00:00.000Z";

export const EXERCISE_LIBRARY_SEED: ExerciseLibraryItem[] = EXERCISE_LIBRARY_CATALOG.map((exercise, index) =>
  createExerciseSeedFromCatalog(exercise, {
    id: `ex-lib-${String(index + 1).padStart(3, "0")}`,
    slug: slugifyExerciseName(exercise.name),
    isActive: true,
    isGlobal: true,
    createdBy: null,
    createdAt,
    updatedAt: createdAt,
  }),
);
