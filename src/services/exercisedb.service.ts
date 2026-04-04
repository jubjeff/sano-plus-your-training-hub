import { fallbackBodyParts, fallbackEquipment, fallbackExercises, fallbackTargets } from "@/lib/exercisedb-fallback";
import { mapExerciseDbToCatalogItem } from "@/lib/exercisedb-mappers";
import {
  ExerciseDbApiExercise,
  ExerciseDbLookupResult,
  ExerciseDbSearchFilters,
  ExerciseDbSearchResult,
} from "@/types/exercisedb";

const DEFAULT_LIMIT = 12;
const CACHE_TTL_MS = 1000 * 60 * 10;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

function getCachedValue<T>(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCachedValue<T>(key: string, value: T) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function serializeParams(params: Record<string, string | number | undefined>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
}

async function fetchJson<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  const query = serializeParams(params);
  const response = await fetch(`/api/exercisedb${path}${query ? `?${query}` : ""}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let errorMessage = `ExerciseDB request failed with status ${response.status}`;

    try {
      const errorPayload = (await response.json()) as { error?: string };
      if (errorPayload?.error) {
        errorMessage = errorPayload.error;
      }
    } catch {
      // Keep the generic message when the response body is not JSON.
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

function applyClientFilters(exercises: ExerciseDbApiExercise[], filters: ExerciseDbSearchFilters) {
  return exercises.filter((exercise) => {
    const matchesQuery = !filters.query || exercise.name.toLowerCase().includes(filters.query.toLowerCase());
    const matchesBodyPart = !filters.bodyPart || exercise.bodyPart === filters.bodyPart;
    const matchesTarget = !filters.target || exercise.target === filters.target;
    const matchesEquipment = !filters.equipment || exercise.equipment === filters.equipment;
    return matchesQuery && matchesBodyPart && matchesTarget && matchesEquipment;
  });
}

function filterFallbackExercises(filters: ExerciseDbSearchFilters) {
  return fallbackExercises.filter((exercise) => {
    const matchesQuery = !filters.query || exercise.name.toLowerCase().includes(filters.query.toLowerCase());
    const matchesBodyPart = !filters.bodyPart || exercise.bodyPart?.toLowerCase() === filters.bodyPart.toLowerCase();
    const matchesTarget = !filters.target || exercise.target?.toLowerCase() === filters.target.toLowerCase();
    const matchesEquipment = !filters.equipment || exercise.equipment?.some((item) => item.toLowerCase() === filters.equipment?.toLowerCase());
    return matchesQuery && matchesBodyPart && matchesTarget && matchesEquipment;
  });
}

async function fetchExerciseCollection(filters: ExerciseDbSearchFilters) {
  if (filters.query) {
    return fetchJson<ExerciseDbApiExercise[]>(`/exercises/name/${encodeURIComponent(filters.query)}`);
  }
  if (filters.target) {
    return fetchJson<ExerciseDbApiExercise[]>(`/exercises/target/${encodeURIComponent(filters.target)}`);
  }
  if (filters.equipment) {
    return fetchJson<ExerciseDbApiExercise[]>(`/exercises/equipment/${encodeURIComponent(filters.equipment)}`);
  }
  if (filters.bodyPart) {
    return fetchJson<ExerciseDbApiExercise[]>(`/exercises/bodyPart/${encodeURIComponent(filters.bodyPart)}`);
  }
  return fetchJson<ExerciseDbApiExercise[]>("/exercises", { limit: filters.limit ?? DEFAULT_LIMIT });
}

export async function searchExerciseDbExercises(filters: ExerciseDbSearchFilters): Promise<ExerciseDbSearchResult> {
  const normalizedFilters = {
    query: filters.query.trim(),
    bodyPart: filters.bodyPart,
    target: filters.target,
    equipment: filters.equipment,
    limit: filters.limit ?? DEFAULT_LIMIT,
  };

  const cacheKey = `exercisedb:search:${serializeParams(normalizedFilters)}`;
  const cached = getCachedValue<ExerciseDbSearchResult>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await fetchExerciseCollection(normalizedFilters);
    const filtered = applyClientFilters(raw, normalizedFilters).slice(0, normalizedFilters.limit);
    const value: ExerciseDbSearchResult = {
      items: filtered.map(mapExerciseDbToCatalogItem),
      total: filtered.length,
      usedFallback: false,
    };
    setCachedValue(cacheKey, value);
    return value;
  } catch (error) {
    const fallback = filterFallbackExercises(normalizedFilters).slice(0, normalizedFilters.limit);
    return {
      items: fallback,
      total: fallback.length,
      usedFallback: true,
      fallbackReason: error instanceof Error ? error.message : "ExerciseDB request failed.",
    };
  }
}

export async function getExerciseDbExerciseById(exerciseId: string) {
  const cacheKey = `exercisedb:details:${exerciseId}`;
  const cached = getCachedValue<ExerciseDbApiExercise | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const response = await fetchJson<ExerciseDbApiExercise>(`/exercises/exercise/${encodeURIComponent(exerciseId)}`);
    setCachedValue(cacheKey, response);
    return response;
  } catch {
    return null;
  }
}

export async function listExerciseDbBodyParts(): Promise<ExerciseDbLookupResult> {
  const cacheKey = "exercisedb:bodyparts";
  const cached = getCachedValue<ExerciseDbLookupResult>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchJson<string[]>("/exercises/bodyPartList");
    const value = { items: response.map((item) => ({ id: item, label: item })), usedFallback: false };
    setCachedValue(cacheKey, value);
    return value;
  } catch (error) {
    return {
      items: fallbackBodyParts,
      usedFallback: true,
      fallbackReason: error instanceof Error ? error.message : "ExerciseDB request failed.",
    };
  }
}

export async function listExerciseDbTargets(): Promise<ExerciseDbLookupResult> {
  const cacheKey = "exercisedb:targets";
  const cached = getCachedValue<ExerciseDbLookupResult>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchJson<string[]>("/exercises/targetList");
    const value = { items: response.map((item) => ({ id: item, label: item })), usedFallback: false };
    setCachedValue(cacheKey, value);
    return value;
  } catch (error) {
    return {
      items: fallbackTargets,
      usedFallback: true,
      fallbackReason: error instanceof Error ? error.message : "ExerciseDB request failed.",
    };
  }
}

export async function listExerciseDbEquipment(): Promise<ExerciseDbLookupResult> {
  const cacheKey = "exercisedb:equipment";
  const cached = getCachedValue<ExerciseDbLookupResult>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchJson<string[]>("/exercises/equipmentList");
    const value = { items: response.map((item) => ({ id: item, label: item })), usedFallback: false };
    setCachedValue(cacheKey, value);
    return value;
  } catch (error) {
    return {
      items: fallbackEquipment,
      usedFallback: true,
      fallbackReason: error instanceof Error ? error.message : "ExerciseDB request failed.",
    };
  }
}
