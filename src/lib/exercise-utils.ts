import { Exercise, Workout } from "@/types";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function now() {
  return new Date().toISOString();
}

export function createEmptyExercise(): Exercise {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    description: "",
    sets: 3,
    reps: "12",
    load: "",
    studentLoad: null,
    rest: "60s",
    notes: "",
    equipment: "",
    muscleCategory: null,
    muscleGroupPrimary: null,
    muscleGroupsSecondary: [],
    videoFileUrl: null,
    videoStorageKey: null,
    youtubeUrl: "",
    youtubeEmbedUrl: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function cloneExerciseForAssignment(exercise: Exercise): Exercise {
  return {
    ...exercise,
    id: generateId(),
    muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])],
    createdAt: now(),
    updatedAt: now(),
  };
}

export function stampExerciseUpdate(exercise: Exercise): Exercise {
  return {
    ...exercise,
    updatedAt: now(),
    createdAt: exercise.createdAt ?? now(),
  };
}

export function getExerciseDescription(exercise: Exercise) {
  return exercise.description?.trim() || "";
}

export function getExerciseFingerprint(exercise: Exercise) {
  return [
    exercise.name.trim().toLowerCase(),
    exercise.muscleCategory ?? "",
    exercise.muscleGroupPrimary ?? "",
    exercise.equipment ?? "",
    getExerciseDescription(exercise).toLowerCase(),
    exercise.videoFileUrl ?? "",
    exercise.videoStorageKey ?? "",
    exercise.youtubeUrl ?? "",
  ].join("|");
}

export function collectUniqueExercisesFromWorkouts(workouts: Workout[]) {
  const unique = new Map<string, Exercise>();

  workouts.forEach((workout) => {
    workout.blocks.forEach((block) => {
      block.exercises.forEach((exercise) => {
        const fingerprint = getExerciseFingerprint(exercise);
        if (!fingerprint.trim()) return;
        if (!unique.has(fingerprint)) {
          unique.set(fingerprint, cloneExerciseForAssignment(exercise));
        }
      });
    });
  });

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
}
