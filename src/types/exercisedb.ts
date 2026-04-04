import { Exercise } from "@/types";

export interface ExerciseDbApiExercise {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl?: string;
  secondaryMuscles?: string[];
  instructions?: string[];
}

export interface ExerciseDbSearchFilters {
  query: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  limit?: number;
}

export interface ExerciseLookupOption {
  id: string;
  label: string;
}

export interface SanoExerciseCatalogItem extends Omit<Exercise, "id" | "sets" | "reps" | "load" | "rest" | "notes"> {
  externalId: string;
  source: "exercisedb";
}

export interface ExerciseDbSearchResult {
  items: SanoExerciseCatalogItem[];
  total: number;
  usedFallback: boolean;
  fallbackReason?: string;
}

export interface ExerciseDbLookupResult {
  items: ExerciseLookupOption[];
  usedFallback: boolean;
  fallbackReason?: string;
}
