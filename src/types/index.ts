export type StudentAccessStatus = "temporary_password_pending" | "active" | "inactive";
export type StudentStatus = "active" | "inactive";
export type ProofOfPaymentStatus = "not_sent" | "submitted" | "approved";
export type StudentFinancialStatus = "paid" | "due_soon" | "overdue" | "blocked" | "proof_submitted" | "inactive";
export type TrainingStructureType = "weekly" | "abcde";
export type TrainingProgressMode = "fixed_schedule" | "sequential_progression";
export type WorkoutBlockType = "standard" | "rest" | "cardio" | "mobility" | "recovery";
export type StudentEngagementStatus = "active" | "attention" | "disengaged";
export type CoachAlertType = "no_check_in" | "below_goal" | "payment_blocked";

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  sets: number;
  reps: string;
  load: string;
  studentLoad?: string | null;
  rest: string;
  notes: string;
  equipment?: string | null;
  muscleCategory?: string | null;
  muscleGroupPrimary?: string | null;
  muscleGroupsSecondary?: string[];
  videoFileUrl?: string | null;
  videoStorageKey?: string | null;
  youtubeUrl?: string | null;
  youtubeEmbedUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkoutBlock {
  id: string;
  name: string;
  blockType?: WorkoutBlockType;
  blockLabel?: string | null;
  dayOfWeek?: number | null;
  letterLabel?: string | null;
  orderIndex?: number;
  isRestDay?: boolean;
  notes?: string;
  estimatedDuration?: number | null;
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

export interface WorkoutPlan {
  id: string;
  studentId: string;
  trainingStructureType: TrainingStructureType;
  trainingProgressMode: TrainingProgressMode;
  planName: string;
  isActive: boolean;
  startDate: string;
  endDate?: string | null;
  nextWorkoutChangeDate?: string | null;
  currentSuggestedBlockId?: string | null;
  lastCompletedBlockId?: string | null;
  lastCompletedAt?: string | null;
  weeklyGoal?: number | null;
  createdAt: string;
  updatedAt: string;
  blocks: WorkoutBlock[];
}

export interface Student {
  id: string;
  coachId: string;
  userId?: string | null;
  mustChangePassword?: boolean;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  profilePhotoUrl?: string | null;
  profilePhotoStorageKey?: string | null;
  goal: string;
  notes: string;
  accessStatus: StudentAccessStatus;
  studentStatus: StudentStatus;
  temporaryPasswordGeneratedAt?: string | null;
  firstAccessCompletedAt?: string | null;
  lastLoginAt?: string | null;
  lastCheckInAt?: string | null;
  paymentDueDate?: string | null;
  paymentLastPaidAt?: string | null;
  proofOfPaymentStatus?: ProofOfPaymentStatus;
  proofOfPaymentStorageKey?: string | null;
  proofOfPaymentFileUrl?: string | null;
  proofOfPaymentFileName?: string | null;
  proofOfPaymentMimeType?: string | null;
  proofOfPaymentSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  startDate: string;
  workoutPlan?: WorkoutPlan | null;
  workout: WorkoutBlock[];
  workoutUpdatedAt?: string;
  nextWorkoutChange?: string;
}

export interface StudentTemporaryAccess {
  studentId: string;
  studentName: string;
  email: string;
  temporaryPassword: string;
  generatedAt: string;
}

export interface StudentCheckIn {
  id: string;
  studentId: string;
  workoutPlanId?: string | null;
  workoutBlockId?: string | null;
  trainingStructureType?: TrainingStructureType | null;
  trainingProgressMode?: TrainingProgressMode | null;
  blockLabel?: string | null;
  checkedInAt: string;
  checkInDate?: string;
  createdAt: string;
  source: "student" | "coach";
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface StudentEngagementStats {
  studentId: string;
  weeklyCheckIns: number;
  monthlyCheckIns: number;
  attendanceRate: number;
  currentStreak: number;
  bestStreak: number;
  lastCheckInAt: string | null;
  nextSuggestedBlockId: string | null;
  weeklyGoal: number;
  weeklyGoalProgress: number;
  weeklyGoalAchieved: boolean;
  engagementStatus: StudentEngagementStatus;
  daysWithoutCheckIn: number;
  updatedAt: string;
}

export interface CoachAlert {
  id: string;
  coachId: string;
  studentId: string;
  alertType: CoachAlertType;
  title: string;
  description: string;
  isRead: boolean;
  createdAt: string;
}
