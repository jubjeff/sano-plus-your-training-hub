import type {
  ExerciseBodyRegion,
  ExerciseCategory,
  ExerciseDifficultyLevel,
  ExerciseLaterality,
  ExerciseMechanicalType,
  ExerciseMovementCategory,
  ExerciseMovementPlane,
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

export const EXERCISE_MOVEMENT_CATEGORY_OPTIONS: ExerciseMovementCategory[] = [
  "Empurrar horizontal",
  "Empurrar vertical",
  "Puxar horizontal",
  "Puxar vertical",
  "Agachar",
  "Avanço",
  "Hinge",
  "Flexão de cotovelo",
  "Extensão de cotovelo",
  "Flexão de joelho",
  "Extensão de joelho",
  "Flexão plantar",
  "Flexão de tronco",
  "Anti-extensão",
  "Rotação de tronco",
  "Abdução de quadril",
  "Adução de quadril",
  "Extensão de quadril",
  "Abdução de ombro",
  "Flexão de ombro",
  "Retração escapular",
  "Carregada",
  "Potência",
  "Locomoção",
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

export const EXERCISE_MECHANICAL_TYPE_OPTIONS: ExerciseMechanicalType[] = ["Composto", "Isolado"];

export const EXERCISE_LATERALITY_OPTIONS: ExerciseLaterality[] = ["Bilateral", "Unilateral"];

export const EXERCISE_MOVEMENT_PLANE_OPTIONS: ExerciseMovementPlane[] = ["Sagital", "Frontal", "Transversal", "Multiplanar"];

export const EXERCISE_EQUIPMENT_SUGGESTIONS = [
  "Barra",
  "Halteres",
  "Máquina",
  "Cabo",
  "Banco",
  "Banco inclinado",
  "Banco declinado",
  "Banco Scott",
  "Kettlebell",
  "Smith",
  "Leg press",
  "Hack machine",
  "Barra fixa",
  "Paralelas",
  "Barra T",
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
