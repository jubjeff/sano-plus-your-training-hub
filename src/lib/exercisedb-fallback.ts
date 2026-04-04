import { ExerciseLookupOption, SanoExerciseCatalogItem } from "@/types/exercisedb";

export const fallbackBodyParts: ExerciseLookupOption[] = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "upper legs", label: "Upper Legs" },
  { id: "shoulders", label: "Shoulders" },
  { id: "waist", label: "Waist" },
];

export const fallbackTargets: ExerciseLookupOption[] = [
  { id: "pectorals", label: "Pectorals" },
  { id: "lats", label: "Lats" },
  { id: "quads", label: "Quads" },
  { id: "glutes", label: "Glutes" },
  { id: "abs", label: "Abs" },
];

export const fallbackEquipment: ExerciseLookupOption[] = [
  { id: "body weight", label: "Body Weight" },
  { id: "dumbbell", label: "Dumbbell" },
  { id: "barbell", label: "Barbell" },
  { id: "cable", label: "Cable" },
  { id: "leverage machine", label: "Leverage Machine" },
];

export const fallbackExercises: SanoExerciseCatalogItem[] = [
  {
    source: "exercisedb",
    externalId: "fallback-push-up",
    name: "Push-Up",
    instructions: "Keep the body aligned, lower with control, and press through the hands to return to the top.",
    summary: "Classic push-up for chest, shoulders and triceps.",
    muscles: ["Pectorals"],
    equipment: ["Body Weight"],
    category: "Chest",
    bodyPart: "Chest",
    target: "Pectorals",
    secondaryMuscles: ["Triceps", "Delts"],
    imageUrl: null,
    mediaUrls: [],
    metadata: { fallback: true },
  },
  {
    source: "exercisedb",
    externalId: "fallback-goblet-squat",
    name: "Goblet Squat",
    instructions: "Hold a dumbbell close to the chest, keep the torso upright, and squat to a comfortable depth with control.",
    summary: "Didactic squat for legs and core stability.",
    muscles: ["Quads"],
    equipment: ["Dumbbell"],
    category: "Upper Legs",
    bodyPart: "Upper Legs",
    target: "Quads",
    secondaryMuscles: ["Glutes", "Abs"],
    imageUrl: null,
    mediaUrls: [],
    metadata: { fallback: true },
  },
  {
    source: "exercisedb",
    externalId: "fallback-seated-row",
    name: "Seated Row",
    instructions: "Pull the handle toward the torso with the chest open, pause briefly, and return under control.",
    summary: "Back exercise focused on lats and scapular control.",
    muscles: ["Lats"],
    equipment: ["Cable"],
    category: "Back",
    bodyPart: "Back",
    target: "Lats",
    secondaryMuscles: ["Biceps", "Rear Delts"],
    imageUrl: null,
    mediaUrls: [],
    metadata: { fallback: true },
  },
];
