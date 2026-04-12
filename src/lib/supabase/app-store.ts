import { getSupabaseClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/auth-validators";
import { buildCoachAlertDrafts, createDefaultWorkoutPlan, getNextSuggestedBlock, getStudentWorkoutPlan } from "@/lib/training-management";
import { loadPersistedExerciseVideo, persistExerciseVideoFile } from "@/lib/exercise-media";
import { loadPaymentProofFile, persistPaymentProofFile } from "@/lib/payment-proof";
import { loadPersistedProfileImage, persistProfileImageFile } from "@/lib/profile-media";
import type { AuthUser } from "@/types/auth";
import type { CoachAlert, Student, StudentCheckIn, Workout, WorkoutBlock, WorkoutPlan } from "@/types";

type StoreSnapshot = {
  students: Student[];
  workouts: Workout[];
  checkIns: StudentCheckIn[];
  alerts: CoachAlert[];
};

type Listener = () => void;

type StudentRow = {
  id: string;
  teacher_id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  goal: string | null;
  notes: string | null;
  status: string;
  access_status: string;
  temporary_password_generated_at: string | null;
  first_access_completed_at: string | null;
  last_login_at: string | null;
  last_check_in_at: string | null;
  payment_due_date: string | null;
  payment_last_paid_at: string | null;
  proof_of_payment_status: string | null;
  proof_of_payment_storage_key: string | null;
  proof_of_payment_file_url: string | null;
  proof_of_payment_file_name: string | null;
  proof_of_payment_mime_type: string | null;
  proof_of_payment_sent_at: string | null;
  profile_photo_storage_key: string | null;
  profile_photo_url: string | null;
  created_at: string;
  updated_at: string;
  start_date: string;
  workout_updated_at: string | null;
  next_workout_change: string | null;
};

type StudentPlanRow = {
  id: string;
  teacher_id: string;
  student_id: string;
  training_structure_type: "weekly" | "abcde";
  training_progress_mode: "fixed_schedule" | "sequential_progression";
  plan_name: string;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  next_workout_change_date: string | null;
  current_suggested_block_id: string | null;
  last_completed_block_id: string | null;
  last_completed_at: string | null;
  weekly_goal: number;
  blocks: WorkoutBlock[];
  created_at: string;
  updated_at: string;
};

type WorkoutTemplateRow = {
  id: string;
  teacher_id: string;
  name: string;
  objective: string;
  notes: string;
  blocks: WorkoutBlock[];
  created_at: string;
  updated_at: string;
};

type StudentCheckInRow = {
  id: string;
  teacher_id: string;
  student_id: string;
  workout_plan_id: string | null;
  workout_block_id: string | null;
  training_structure_type: string | null;
  training_progress_mode: string | null;
  block_label: string | null;
  checked_in_at: string;
  check_in_date: string;
  source: "student" | "coach";
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
};

type CoachAlertReadRow = {
  alert_id: string;
  is_read: boolean;
  created_at: string;
};

const EMPTY_SNAPSHOT: StoreSnapshot = {
  students: [],
  workouts: [],
  checkIns: [],
  alerts: [],
};

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(date: string, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().split("T")[0];
}

async function hydrateBlocks(blocks: WorkoutBlock[] | null | undefined) {
  if (!Array.isArray(blocks)) return [];

  return Promise.all(
    blocks.map(async (block) => ({
      ...block,
      exercises: await Promise.all(
        (block.exercises ?? []).map(async (exercise) => ({
          ...exercise,
          muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])],
          videoFileUrl:
            exercise.videoStorageKey
              ? await loadPersistedExerciseVideo(exercise.videoStorageKey).catch(() => exercise.videoFileUrl ?? null)
              : exercise.videoFileUrl ?? null,
        })),
      ),
    })),
  );
}

async function mapWorkoutTemplate(row: WorkoutTemplateRow): Promise<Workout> {
  return {
    id: row.id,
    name: row.name,
    objective: row.objective,
    notes: row.notes,
    blocks: await hydrateBlocks(row.blocks),
    createdAt: row.created_at,
  };
}

async function mapStudent(row: StudentRow, plan?: StudentPlanRow | null): Promise<Student> {
  const hydratedPlanBlocks = await hydrateBlocks(plan?.blocks ?? []);
  const workoutPlan: WorkoutPlan | null = plan
    ? {
        id: plan.id,
        studentId: row.id,
        trainingStructureType: plan.training_structure_type,
        trainingProgressMode: plan.training_progress_mode,
        planName: plan.plan_name,
        isActive: plan.is_active,
        startDate: plan.start_date,
        endDate: plan.end_date,
        nextWorkoutChangeDate: plan.next_workout_change_date,
        currentSuggestedBlockId: plan.current_suggested_block_id,
        lastCompletedBlockId: plan.last_completed_block_id,
        lastCompletedAt: plan.last_completed_at,
        weeklyGoal: plan.weekly_goal,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
        blocks: hydratedPlanBlocks,
      }
    : null;

  const profilePhotoUrl =
    row.profile_photo_url ||
    (row.profile_photo_storage_key ? await loadPersistedProfileImage(row.profile_photo_storage_key).catch(() => null) : null);

  const proofFileUrl =
    row.proof_of_payment_file_url ||
    (row.proof_of_payment_storage_key
      ? await loadPaymentProofFile(row.proof_of_payment_storage_key)
          .then((file) => (file ? URL.createObjectURL(file) : null))
          .catch(() => null)
      : null);

  return {
    id: row.id,
    coachId: row.teacher_id,
    userId: row.auth_user_id,
    fullName: row.full_name,
    email: normalizeEmail(row.email ?? ""),
    phone: row.phone ?? "",
    birthDate: row.birth_date ?? row.start_date,
    profilePhotoStorageKey: row.profile_photo_storage_key,
    profilePhotoUrl,
    goal: row.goal ?? "",
    notes: row.notes ?? "",
    accessStatus: row.access_status as Student["accessStatus"],
    studentStatus: row.status as Student["studentStatus"],
    temporaryPasswordGeneratedAt: row.temporary_password_generated_at,
    firstAccessCompletedAt: row.first_access_completed_at,
    lastLoginAt: row.last_login_at,
    lastCheckInAt: row.last_check_in_at,
    paymentDueDate: row.payment_due_date,
    paymentLastPaidAt: row.payment_last_paid_at,
    proofOfPaymentStatus: (row.proof_of_payment_status ?? "not_sent") as Student["proofOfPaymentStatus"],
    proofOfPaymentStorageKey: row.proof_of_payment_storage_key,
    proofOfPaymentFileUrl: proofFileUrl,
    proofOfPaymentFileName: row.proof_of_payment_file_name,
    proofOfPaymentMimeType: row.proof_of_payment_mime_type,
    proofOfPaymentSentAt: row.proof_of_payment_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startDate: row.start_date,
    workoutPlan,
    workout: workoutPlan?.blocks ?? [],
    workoutUpdatedAt: row.workout_updated_at ?? undefined,
    nextWorkoutChange: row.next_workout_change ?? undefined,
  };
}

function mapCheckIn(row: StudentCheckInRow): StudentCheckIn {
  return {
    id: row.id,
    studentId: row.student_id,
    workoutPlanId: row.workout_plan_id,
    workoutBlockId: row.workout_block_id,
    trainingStructureType: row.training_structure_type as StudentCheckIn["trainingStructureType"],
    trainingProgressMode: row.training_progress_mode as StudentCheckIn["trainingProgressMode"],
    blockLabel: row.block_label,
    checkedInAt: row.checked_in_at,
    checkInDate: row.check_in_date,
    createdAt: row.created_at,
    source: row.source,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
  };
}

async function resolveOwnTeacherId() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("teachers").select("id").single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Professor nao encontrado.");
  }

  return data.id as string;
}

async function fetchCoachSnapshot(): Promise<StoreSnapshot> {
  const supabase = getSupabaseClient();
  const [studentsResponse, plansResponse, workoutsResponse, checkInsResponse, alertReadsResponse] = await Promise.all([
    supabase
      .from("students")
      .select(`
        id, teacher_id, auth_user_id, full_name, email, phone, birth_date, goal, notes, status, access_status,
        temporary_password_generated_at, first_access_completed_at, last_login_at, last_check_in_at,
        payment_due_date, payment_last_paid_at, proof_of_payment_status, proof_of_payment_storage_key,
        proof_of_payment_file_url, proof_of_payment_file_name, proof_of_payment_mime_type, proof_of_payment_sent_at,
        profile_photo_storage_key, profile_photo_url, created_at, updated_at, start_date, workout_updated_at, next_workout_change
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_workout_plans")
      .select(`
        id, teacher_id, student_id, training_structure_type, training_progress_mode, plan_name, is_active,
        start_date, end_date, next_workout_change_date, current_suggested_block_id, last_completed_block_id,
        last_completed_at, weekly_goal, blocks, created_at, updated_at
      `),
    supabase
      .from("workout_templates")
      .select("id, teacher_id, name, objective, notes, blocks, created_at, updated_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("student_check_ins")
      .select(`
        id, teacher_id, student_id, workout_plan_id, workout_block_id, training_structure_type,
        training_progress_mode, block_label, checked_in_at, check_in_date, source, duration_minutes, notes, created_at
      `)
      .order("checked_in_at", { ascending: false }),
    supabase.from("coach_alert_reads").select("alert_id, is_read, created_at"),
  ]);

  if (studentsResponse.error) throw new Error(studentsResponse.error.message);
  if (plansResponse.error) throw new Error(plansResponse.error.message);
  if (workoutsResponse.error) throw new Error(workoutsResponse.error.message);
  if (checkInsResponse.error) throw new Error(checkInsResponse.error.message);
  if (alertReadsResponse.error) throw new Error(alertReadsResponse.error.message);

  const plansByStudent = new Map((plansResponse.data ?? []).map((plan) => [plan.student_id, plan as StudentPlanRow]));
  const students = await Promise.all((studentsResponse.data ?? []).map((row) => mapStudent(row as StudentRow, plansByStudent.get(row.id) ?? null)));
  const workouts = await Promise.all((workoutsResponse.data ?? []).map((row) => mapWorkoutTemplate(row as WorkoutTemplateRow)));
  const checkIns = (checkInsResponse.data ?? []).map((row) => mapCheckIn(row as StudentCheckInRow));

  const readsByAlert = new Map((alertReadsResponse.data ?? []).map((row) => [row.alert_id, row as CoachAlertReadRow]));
  const alertDrafts = buildCoachAlertDrafts(students, checkIns);
  const alerts: CoachAlert[] = alertDrafts.map((draft) => {
    const readRecord = readsByAlert.get(draft.id);
    return {
      ...draft,
      isRead: readRecord?.is_read ?? false,
      createdAt: readRecord?.created_at ?? nowIso(),
    };
  });

  return { students, workouts, checkIns, alerts };
}

async function fetchStudentSnapshot(authUserId: string): Promise<StoreSnapshot> {
  const supabase = getSupabaseClient();
  const { data: studentRows, error: studentError } = await supabase
    .from("students")
    .select(`
      id, teacher_id, auth_user_id, full_name, email, phone, birth_date, goal, notes, status, access_status,
      temporary_password_generated_at, first_access_completed_at, last_login_at, last_check_in_at,
      payment_due_date, payment_last_paid_at, proof_of_payment_status, proof_of_payment_storage_key,
      proof_of_payment_file_url, proof_of_payment_file_name, proof_of_payment_mime_type, proof_of_payment_sent_at,
      profile_photo_storage_key, profile_photo_url, created_at, updated_at, start_date, workout_updated_at, next_workout_change
    `)
    .eq("auth_user_id", authUserId)
    .limit(1);

  if (studentError) throw new Error(studentError.message);
  const studentRow = (studentRows ?? [])[0] as StudentRow | undefined;

  if (!studentRow) {
    return EMPTY_SNAPSHOT;
  }

  const [planResponse, checkInsResponse] = await Promise.all([
    getSupabaseClient()
      .from("student_workout_plans")
      .select(`
        id, teacher_id, student_id, training_structure_type, training_progress_mode, plan_name, is_active,
        start_date, end_date, next_workout_change_date, current_suggested_block_id, last_completed_block_id,
        last_completed_at, weekly_goal, blocks, created_at, updated_at
      `)
      .eq("student_id", studentRow.id)
      .limit(1),
    getSupabaseClient()
      .from("student_check_ins")
      .select(`
        id, teacher_id, student_id, workout_plan_id, workout_block_id, training_structure_type,
        training_progress_mode, block_label, checked_in_at, check_in_date, source, duration_minutes, notes, created_at
      `)
      .eq("student_id", studentRow.id)
      .order("checked_in_at", { ascending: false }),
  ]);

  if (planResponse.error) throw new Error(planResponse.error.message);
  if (checkInsResponse.error) throw new Error(checkInsResponse.error.message);

  const planRow = (planResponse.data ?? [])[0] as StudentPlanRow | undefined;
  const student = await mapStudent(studentRow, planRow ?? null);
  const checkIns = (checkInsResponse.data ?? []).map((row) => mapCheckIn(row as StudentCheckInRow));

  return {
    students: [student],
    workouts: [],
    checkIns,
    alerts: [],
  };
}

async function syncStudentPlan(student: Student, updates?: Partial<Student>) {
  const supabase = getSupabaseClient();
  const nextStartDate = updates?.startDate ?? student.startDate;
  const workoutPlan = updates?.workoutPlan
    ? {
        ...updates.workoutPlan,
        blocks: updates.workoutPlan.blocks ?? updates.workout ?? student.workout,
      }
    : createDefaultWorkoutPlan(
        {
          id: student.id,
          startDate: nextStartDate,
          nextWorkoutChange: updates?.nextWorkoutChange ?? student.nextWorkoutChange,
          workoutUpdatedAt: updates?.workoutUpdatedAt ?? student.workoutUpdatedAt,
          workout: updates?.workout ?? student.workout,
        },
        student.workoutPlan ?? undefined,
      );

  const { error } = await supabase
    .from("student_workout_plans")
    .upsert(
      {
        student_id: student.id,
        teacher_id: student.coachId,
        training_structure_type: workoutPlan.trainingStructureType,
        training_progress_mode: workoutPlan.trainingProgressMode,
        plan_name: workoutPlan.planName,
        is_active: workoutPlan.isActive,
        start_date: workoutPlan.startDate,
        end_date: workoutPlan.endDate ?? null,
        next_workout_change_date: workoutPlan.nextWorkoutChangeDate ?? updates?.nextWorkoutChange ?? student.nextWorkoutChange ?? null,
        current_suggested_block_id: workoutPlan.currentSuggestedBlockId ?? null,
        last_completed_block_id: workoutPlan.lastCompletedBlockId ?? null,
        last_completed_at: workoutPlan.lastCompletedAt ?? null,
        weekly_goal: workoutPlan.weeklyGoal ?? 4,
        blocks: workoutPlan.blocks,
      },
      { onConflict: "student_id" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export class SupabaseAppStore {
  private snapshot: StoreSnapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<Listener>();
  private sessionKey: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  getSnapshot = () => this.snapshot;
  getStudents = () => this.snapshot.students;
  getWorkouts = () => this.snapshot.workouts;
  getCheckIns = () => this.snapshot.checkIns;
  getAlerts = () => this.snapshot.alerts;
  getStudent = (id: string) => this.snapshot.students.find((student) => student.id === id);
  getStudentByUserId = (userId?: string | null) => (userId ? this.snapshot.students.find((student) => student.userId === userId) : undefined);
  getStudentCheckIns = (studentId: string) =>
    this.snapshot.checkIns
      .filter((checkIn) => checkIn.studentId === studentId)
      .sort((left, right) => new Date(right.checkedInAt).getTime() - new Date(left.checkedInAt).getTime());
  getWorkout = (id: string) => this.snapshot.workouts.find((workout) => workout.id === id);

  async ensureUser(user: AuthUser | null) {
    const nextKey = user ? `${user.role}:${user.id}` : null;
    if (nextKey === this.sessionKey && !this.refreshPromise) return;

    this.sessionKey = nextKey;
    this.refreshPromise = this.loadSnapshotForUser(user).finally(() => {
      this.refreshPromise = null;
    });
    await this.refreshPromise;
  }

  async refresh(user: AuthUser | null) {
    await this.loadSnapshotForUser(user);
  }

  private async loadSnapshotForUser(user: AuthUser | null) {
    if (!user) {
      this.snapshot = EMPTY_SNAPSHOT;
      this.emit();
      return;
    }

    try {
      this.snapshot = user.role === "coach" ? await fetchCoachSnapshot() : await fetchStudentSnapshot(user.id);
    } catch {
      this.snapshot = EMPTY_SNAPSHOT;
    }
    this.emit();
  }

  private async refreshCoachSnapshot() {
    this.snapshot = await fetchCoachSnapshot().catch(() => EMPTY_SNAPSHOT);
    this.emit();
  }

  private async refreshForCurrentSession() {
    if (!this.sessionKey) return;
    const [role, userId] = this.sessionKey.split(":");
    if (role === "coach") {
      await this.refreshCoachSnapshot();
      return;
    }

    this.snapshot = await fetchStudentSnapshot(userId).catch(() => EMPTY_SNAPSHOT);
    this.emit();
  }

  async addStudent(data: {
    coachId: string;
    fullName: string;
    email: string;
    phone: string;
    birthDate: string;
    goal: string;
    notes: string;
    startDate: string;
    profilePhotoFile?: File | null;
  }) {
    const supabase = getSupabaseClient();
    const teacherId = await resolveOwnTeacherId();
    let profilePhotoStorageKey: string | null = null;
    let profilePhotoUrl: string | null = null;

    if (data.profilePhotoFile) {
      profilePhotoStorageKey = await persistProfileImageFile(data.profilePhotoFile);
      profilePhotoUrl = await loadPersistedProfileImage(profilePhotoStorageKey).catch(() => null);
    }

    const { data: row, error } = await supabase
      .from("students")
      .insert({
        teacher_id: teacherId,
        full_name: data.fullName,
        email: data.email,
        phone: data.phone || null,
        birth_date: data.birthDate,
        goal: data.goal,
        notes: data.notes || null,
        status: "active",
        access_status: "pre_registered",
        payment_due_date: addDays(data.startDate, 30),
        proof_of_payment_status: "not_sent",
        profile_photo_storage_key: profilePhotoStorageKey,
        profile_photo_url: profilePhotoUrl,
        start_date: data.startDate,
      })
      .select(`
        id, teacher_id, auth_user_id, full_name, email, phone, birth_date, goal, notes, status, access_status,
        temporary_password_generated_at, first_access_completed_at, last_login_at, last_check_in_at,
        payment_due_date, payment_last_paid_at, proof_of_payment_status, proof_of_payment_storage_key,
        proof_of_payment_file_url, proof_of_payment_file_name, proof_of_payment_mime_type, proof_of_payment_sent_at,
        profile_photo_storage_key, profile_photo_url, created_at, updated_at, start_date, workout_updated_at, next_workout_change
      `)
      .single();

    if (error || !row) {
      throw new Error(error?.message || "Nao foi possivel salvar o aluno.");
    }

    await supabase.rpc("ensure_student_workout_plan", {
      p_teacher_id: teacherId,
      p_student_id: row.id,
      p_start_date: data.startDate,
      p_next_workout_change_date: null,
    });

    const mappedStudent = await mapStudent(row as StudentRow, null);
    this.snapshot = {
      ...this.snapshot,
      students: [mappedStudent, ...this.snapshot.students],
    };
    this.emit();
    return mappedStudent;
  }

  async updateStudent(id: string, data: Partial<Student> & { profilePhotoFile?: File | null; removeProfilePhoto?: boolean }) {
    const supabase = getSupabaseClient();
    const currentStudent = this.getStudent(id);
    if (!currentStudent) return;

    let profilePhotoStorageKey = currentStudent.profilePhotoStorageKey ?? null;
    let profilePhotoUrl = currentStudent.profilePhotoUrl ?? null;

    if (data.removeProfilePhoto) {
      profilePhotoStorageKey = null;
      profilePhotoUrl = null;
    }

    if (data.profilePhotoFile) {
      profilePhotoStorageKey = await persistProfileImageFile(data.profilePhotoFile, profilePhotoStorageKey);
      profilePhotoUrl = await loadPersistedProfileImage(profilePhotoStorageKey).catch(() => null);
    }

    const { error } = await supabase
      .from("students")
      .update({
        full_name: data.fullName ?? currentStudent.fullName,
        email: data.email ?? currentStudent.email,
        phone: data.phone ?? currentStudent.phone,
        birth_date: data.birthDate ?? currentStudent.birthDate,
        goal: data.goal ?? currentStudent.goal,
        notes: data.notes ?? currentStudent.notes,
        status: data.studentStatus ?? currentStudent.studentStatus,
        access_status: data.accessStatus ?? currentStudent.accessStatus,
        temporary_password_generated_at: data.temporaryPasswordGeneratedAt ?? currentStudent.temporaryPasswordGeneratedAt ?? null,
        first_access_completed_at: data.firstAccessCompletedAt ?? currentStudent.firstAccessCompletedAt ?? null,
        last_login_at: data.lastLoginAt ?? currentStudent.lastLoginAt ?? null,
        last_check_in_at: data.lastCheckInAt ?? currentStudent.lastCheckInAt ?? null,
        payment_due_date: data.paymentDueDate ?? currentStudent.paymentDueDate ?? null,
        payment_last_paid_at: data.paymentLastPaidAt ?? currentStudent.paymentLastPaidAt ?? null,
        proof_of_payment_status: data.proofOfPaymentStatus ?? currentStudent.proofOfPaymentStatus,
        proof_of_payment_storage_key: data.proofOfPaymentStorageKey ?? currentStudent.proofOfPaymentStorageKey ?? null,
        proof_of_payment_file_url: data.proofOfPaymentFileUrl ?? currentStudent.proofOfPaymentFileUrl ?? null,
        proof_of_payment_file_name: data.proofOfPaymentFileName ?? currentStudent.proofOfPaymentFileName ?? null,
        proof_of_payment_mime_type: data.proofOfPaymentMimeType ?? currentStudent.proofOfPaymentMimeType ?? null,
        proof_of_payment_sent_at: data.proofOfPaymentSentAt ?? currentStudent.proofOfPaymentSentAt ?? null,
        profile_photo_storage_key: profilePhotoStorageKey,
        profile_photo_url: profilePhotoUrl,
        start_date: data.startDate ?? currentStudent.startDate,
        workout_updated_at: data.workoutUpdatedAt ?? currentStudent.workoutUpdatedAt ?? null,
        next_workout_change: data.nextWorkoutChange ?? currentStudent.nextWorkoutChange ?? null,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    if (data.workout || data.workoutPlan || data.startDate || data.workoutUpdatedAt || data.nextWorkoutChange) {
      await syncStudentPlan(currentStudent, {
        ...data,
        startDate: data.startDate ?? currentStudent.startDate,
        workout: data.workout ?? currentStudent.workout,
        workoutPlan: data.workoutPlan ?? currentStudent.workoutPlan ?? getStudentWorkoutPlan(currentStudent),
      });
    }

    await this.refreshCoachSnapshot();
  }

  async deleteStudent(id: string) {
    await getSupabaseClient().from("students").delete().eq("id", id).throwOnError();
    this.snapshot = {
      ...this.snapshot,
      students: this.snapshot.students.filter((item) => item.id !== id),
      checkIns: this.snapshot.checkIns.filter((item) => item.studentId !== id),
      alerts: this.snapshot.alerts.filter((item) => item.studentId !== id),
    };
    this.emit();
  }

  async issueStudentTemporaryAccess(studentId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke("issue-student-temporary-access", {
      body: { studentId },
    });

    if (error) {
      throw new Error(error.message);
    }

    await this.refreshCoachSnapshot();
    return data as { studentId: string; studentName: string; email: string; temporaryPassword: string; generatedAt: string };
  }

  async setStudentLifecycle(studentId: string, active: boolean) {
    const student = this.getStudent(studentId);
    if (!student) return;

    const nextAccessStatus = active
      ? student.userId
        ? student.firstAccessCompletedAt
          ? "active"
          : "temporary_password_pending"
        : "pre_registered"
      : "inactive";

    await this.updateStudent(studentId, {
      studentStatus: active ? "active" : "inactive",
      accessStatus: nextAccessStatus,
    });
  }

  async submitProofOfPayment(studentId: string, file: File) {
    const student = this.getStudent(studentId);
    if (!student) throw new Error("Aluno nao encontrado.");

    const storageKey = await persistPaymentProofFile(file, student.proofOfPaymentStorageKey);
    const storedFile = await loadPaymentProofFile(storageKey).catch(() => null);
    const fileUrl = storedFile ? URL.createObjectURL(storedFile) : null;

    if (this.sessionKey?.startsWith("student:")) {
      await getSupabaseClient()
        .rpc("submit_student_payment_proof", {
          p_student_id: studentId,
          p_storage_key: storageKey,
          p_file_url: fileUrl,
          p_file_name: file.name,
          p_mime_type: file.type || null,
          p_sent_at: nowIso(),
        })
        .throwOnError();

      await this.refreshForCurrentSession();
      return;
    }

    await this.updateStudent(studentId, {
      proofOfPaymentStatus: "submitted",
      proofOfPaymentStorageKey: storageKey,
      proofOfPaymentFileUrl: fileUrl,
      proofOfPaymentFileName: file.name,
      proofOfPaymentMimeType: file.type,
      proofOfPaymentSentAt: nowIso(),
    });
  }

  async approveProofOfPayment(studentId: string, paidAt = todayIso()) {
    await this.updateStudent(studentId, {
      paymentLastPaidAt: paidAt,
      paymentDueDate: addDays(paidAt, 30),
      proofOfPaymentStatus: "approved",
    });
  }

  async markPaymentReceived(studentId: string, paidAt = todayIso()) {
    const student = this.getStudent(studentId);
    await this.updateStudent(studentId, {
      paymentLastPaidAt: paidAt,
      paymentDueDate: addDays(paidAt, 30),
      proofOfPaymentStatus: student?.proofOfPaymentStatus === "submitted" ? "approved" : student?.proofOfPaymentStatus,
    });
  }

  async updatePaymentDueDate(studentId: string, dueDate: string) {
    await this.updateStudent(studentId, {
      paymentDueDate: dueDate,
    });
  }

  async registerStudentCheckIn(studentId: string, workoutBlockId?: string | null, source: "student" | "coach" = "student", notes?: string | null) {
    const supabase = getSupabaseClient();
    const student = this.getStudent(studentId);
    if (!student) {
      throw new Error("Aluno nao encontrado.");
    }

    await supabase.rpc("assert_student_can_check_in", {
      p_student_id: studentId,
      p_teacher_id: student.coachId,
      p_check_in_date: todayIso(),
    }).throwOnError();

    const plan = getStudentWorkoutPlan(student);
    const block = workoutBlockId ? plan.blocks.find((item) => item.id === workoutBlockId) : null;

    const { data, error } = await supabase
      .from("student_check_ins")
      .insert({
        teacher_id: student.coachId,
        student_id: studentId,
        workout_plan_id: plan.id,
        workout_block_id: workoutBlockId ?? null,
        training_structure_type: plan.trainingStructureType,
        training_progress_mode: plan.trainingProgressMode,
        block_label: block?.blockLabel ?? block?.letterLabel ?? block?.name ?? null,
        checked_in_at: nowIso(),
        check_in_date: todayIso(),
        source,
        notes: notes ?? null,
      })
      .select(`
        id, teacher_id, student_id, workout_plan_id, workout_block_id, training_structure_type,
        training_progress_mode, block_label, checked_in_at, check_in_date, source, duration_minutes, notes, created_at
      `)
      .single();

    if (error || !data) {
      if (error?.message?.includes("student_check_ins_one_per_day_block_key")) {
        throw new Error("Este treino ja recebeu check-in hoje.");
      }
      throw new Error(error?.message || "Nao foi possivel registrar o check-in.");
    }

    if (plan.trainingProgressMode === "sequential_progression" && block) {
      const nextSuggested = getNextSuggestedBlock(
        {
          ...plan,
          lastCompletedBlockId: block.id,
          lastCompletedAt: data.checked_in_at,
          currentSuggestedBlockId: null,
        },
        [mapCheckIn(data as StudentCheckInRow), ...this.snapshot.checkIns],
      );

      await supabase
        .from("student_workout_plans")
        .update({
          last_completed_block_id: block.id,
          last_completed_at: data.checked_in_at,
          current_suggested_block_id: nextSuggested?.id ?? null,
        })
        .eq("student_id", studentId)
        .throwOnError();
    }

    await this.refreshForCurrentSession();
    return mapCheckIn(data as StudentCheckInRow);
  }

  async updateStudentExerciseLoad(studentId: string, blockId: string, exerciseId: string, studentLoad: string) {
    const student = this.getStudent(studentId);
    if (!student) return;

    if (this.sessionKey?.startsWith("student:")) {
      await getSupabaseClient()
        .rpc("update_student_exercise_load", {
          p_student_id: studentId,
          p_block_id: blockId,
          p_exercise_id: exerciseId,
          p_student_load: studentLoad.trim() || null,
        })
        .throwOnError();

      await this.refreshForCurrentSession();
      return;
    }

    const supabase = getSupabaseClient();

    const plan = getStudentWorkoutPlan(student);
    const nextBlocks = plan.blocks.map((block) =>
      block.id !== blockId
        ? block
        : {
            ...block,
            exercises: block.exercises.map((exercise) =>
              exercise.id !== exerciseId
                ? exercise
                : {
                    ...exercise,
                    studentLoad: studentLoad.trim(),
                    updatedAt: nowIso(),
                  },
            ),
          },
    );

    await supabase
      .from("student_workout_plans")
      .update({
        blocks: nextBlocks,
      })
      .eq("student_id", studentId)
      .throwOnError();

    await this.refreshForCurrentSession();
  }

  async markCoachAlertRead(alertId: string) {
    const supabase = getSupabaseClient();
    const teacherId = await resolveOwnTeacherId();
    await supabase
      .from("coach_alert_reads")
      .upsert({
        teacher_id: teacherId,
        alert_id: alertId,
        is_read: true,
      })
      .throwOnError();

    this.snapshot = {
      ...this.snapshot,
      alerts: this.snapshot.alerts.map((alert) => (alert.id === alertId ? { ...alert, isRead: true } : alert)),
    };
    this.emit();
  }

  async addWorkout(data: Omit<Workout, "id" | "createdAt">) {
    const supabase = getSupabaseClient();
    const teacherId = await resolveOwnTeacherId();
    const { data: row, error } = await supabase
      .from("workout_templates")
      .insert({
        teacher_id: teacherId,
        name: data.name,
        objective: data.objective,
        notes: data.notes,
        blocks: data.blocks,
      })
      .select("id, teacher_id, name, objective, notes, blocks, created_at, updated_at")
      .single();

    if (error || !row) {
      throw new Error(error?.message || "Nao foi possivel criar o treino.");
    }

    const workout = await mapWorkoutTemplate(row as WorkoutTemplateRow);
    this.snapshot = {
      ...this.snapshot,
      workouts: [workout, ...this.snapshot.workouts],
    };
    this.emit();
    return workout;
  }

  async updateWorkout(id: string, data: Partial<Workout>) {
    await getSupabaseClient()
      .from("workout_templates")
      .update({
        name: data.name,
        objective: data.objective,
        notes: data.notes,
        blocks: data.blocks,
      })
      .eq("id", id)
      .throwOnError();

    await this.refreshCoachSnapshot();
  }

  async deleteWorkout(id: string) {
    await getSupabaseClient().from("workout_templates").delete().eq("id", id).throwOnError();
    this.snapshot = {
      ...this.snapshot,
      workouts: this.snapshot.workouts.filter((workout) => workout.id !== id),
    };
    this.emit();
  }

  async duplicateWorkout(id: string) {
    const workout = this.getWorkout(id);
    if (!workout) return;

    const duplicatedBlocks = await Promise.all(
      workout.blocks.map(async (block) => ({
        ...block,
        id: crypto.randomUUID(),
        exercises: await Promise.all(
          block.exercises.map(async (exercise) => {
            let nextVideoStorageKey = exercise.videoStorageKey ?? null;

            if (exercise.videoStorageKey && exercise.videoFileUrl) {
              const response = await fetch(exercise.videoFileUrl);
              const blob = await response.blob();
              const file = new File([blob], `${exercise.name || "video"}.mp4`, { type: blob.type || "video/mp4" });
              nextVideoStorageKey = await persistExerciseVideoFile(file, undefined);
            }

            return {
              ...exercise,
              id: crypto.randomUUID(),
              videoStorageKey: nextVideoStorageKey,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])],
            };
          }),
        ),
      })),
    );

    return this.addWorkout({
      name: `${workout.name} (copia)`,
      objective: workout.objective,
      notes: workout.notes,
      blocks: duplicatedBlocks,
    });
  }

  async importWorkoutToStudent(studentId: string, workoutId: string) {
    const student = this.getStudent(studentId);
    const workout = this.getWorkout(workoutId);
    if (!student || !workout) return;

    const timestamp = todayIso();
    const importedBlocks = workout.blocks.map((block) => ({
      ...block,
      id: crypto.randomUUID(),
      exercises: block.exercises.map((exercise) => ({
        ...exercise,
        id: crypto.randomUUID(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])],
      })),
    }));

    const currentPlan = getStudentWorkoutPlan(student);
    await this.updateStudent(studentId, {
      workout: importedBlocks,
      workoutUpdatedAt: timestamp,
      workoutPlan: {
        ...currentPlan,
        blocks: importedBlocks,
        updatedAt: timestamp,
        nextWorkoutChangeDate: student.nextWorkoutChange ?? currentPlan.nextWorkoutChangeDate ?? null,
      },
    });
  }
}

export const supabaseAppStore = new SupabaseAppStore();
