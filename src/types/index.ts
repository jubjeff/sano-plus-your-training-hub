export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  load: string;
  rest: string;
  notes: string;
}

export interface WorkoutBlock {
  id: string;
  name: string; // e.g. "Treino A"
  exercises: Exercise[];
}

export interface Workout {
  id: string;
  name: string;
  objective: string;
  notes: string;
  blocks: WorkoutBlock[];
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  email: string;
  objective: string;
  notes: string;
  active: boolean;
  startDate: string;
  avatarUrl?: string;
  workout: WorkoutBlock[];
  workoutUpdatedAt?: string;
  nextWorkoutChange?: string;
}
