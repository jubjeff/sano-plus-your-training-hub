import type {
  ExerciseBodyRegion,
  ExerciseCategory,
  ExerciseDifficultyLevel,
  ExerciseMovementType,
  ExerciseType,
} from "@/types";

export const EXERCISE_CATEGORIES: ExerciseCategory[] = ["Musculação", "Mobilidade", "Alongamento", "Cardio"];

export const MUSCLE_CATEGORIES = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Antebraço",
  "Abdômen",
  "Glúteos",
  "Quadríceps e glúteos",
  "Quadríceps",
  "Posterior de coxa",
  "Panturrilhas",
  "Lombar",
  "Corpo inteiro",
  "Mobilidade",
  "Alongamento",
  "Cardiorrespiratório",
] as const;

export const MUSCLE_GROUP_OPTIONS = [
  "Peitoral maior",
  "Peitoral menor",
  "Latíssimo do dorso",
  "Trapézio",
  "Romboides",
  "Deltoide anterior",
  "Deltoide lateral",
  "Deltoide posterior",
  "Bíceps braquial",
  "Braquial",
  "Tríceps braquial",
  "Antebraços",
  "Reto abdominal",
  "Oblíquos",
  "Eretores da espinha",
  "Glúteo máximo",
  "Glúteo médio",
  "Quadríceps",
  "Posterior de coxa",
  "Adutores",
  "Panturrilhas",
  "Tibial anterior",
  "Flexores do quadril",
  "Manguito rotador",
  "Core",
  "Corpo inteiro",
  "Mobilidade",
  "Cardiorrespiratório",
] as const;

export const EXERCISE_MOVEMENT_OPTIONS: ExerciseMovementType[] = [
  "Empurrar",
  "Puxar",
  "Agachar",
  "Levantar",
  "Estabilizar",
  "Rotacionar",
  "Locomover",
  "Isométrico",
  "Mobilidade",
  "Alongamento",
  "Cardio",
];

export const EXERCISE_BODY_REGION_OPTIONS: ExerciseBodyRegion[] = [
  "Membros superiores",
  "Membros inferiores",
  "Tronco",
  "Corpo inteiro",
];

export const EXERCISE_DIFFICULTY_OPTIONS: ExerciseDifficultyLevel[] = ["Iniciante", "Intermediário", "Avançado"];

export const EXERCISE_TYPE_OPTIONS: ExerciseType[] = [
  "Força",
  "Hipertrofia",
  "Resistência",
  "Técnica",
  "Ativação",
  "Mobilidade",
  "Alongamento",
  "Condicionamento",
];

export const EXERCISE_EQUIPMENT_SUGGESTIONS = [
  "Barra",
  "Barra fixa",
  "Barra T",
  "Bastão",
  "Halteres",
  "Máquina",
  "Cabo",
  "Kettlebell",
  "Banco",
  "Banco inclinado",
  "Banco declinado",
  "Banco Scott",
  "Smith",
  "Paralelas",
  "Leg press",
  "Hack machine",
  "Roda abdominal",
  "Peso corporal",
  "Miniband",
  "Elástico",
  "Bola",
  "Corda",
  "Esteira",
  "Bicicleta",
  "Escada",
  "TRX",
  "Sem equipamento",
] as const;
