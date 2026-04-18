import { buildCoachAlertDrafts, createDefaultWorkoutPlan, getBlockDisplayLabel, getNextSuggestedBlock, getStudentWorkoutPlan, normalizeWorkoutBlocks } from "@/lib/training-management";
import { isWorkoutBlockedByPayment } from "@/lib/student-dashboard";
import { normalizeEmail } from "@/lib/auth-validators";
import { getSupabaseClient, hasSupabaseRuntimeConfig } from "@/integrations/supabase/client";
import { teacherAdminActionsService } from "@/services/teacher-admin-actions.service";
import type { CoachAlert, Student, StudentCheckIn, Workout, WorkoutBlock, WorkoutPlan } from "@/types";

type Listener = () => void;

type StudentRow = {
  id: string;
  teacher_id: string;
  auth_user_id: string | null;
  must_change_password: boolean;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  profile_photo_storage_key: string | null;
  profile_photo_url: string | null;
  goal: string | null;
  notes: string | null;
  access_status: Student["accessStatus"];
  status: Student["studentStatus"];
  temporary_password_generated_at: string | null;
  first_access_completed_at: string | null;
  last_login_at: string | null;
  last_check_in_at: string | null;
  payment_due_date: string | null;
  payment_last_paid_at: string | null;
  proof_of_payment_status: Student["proofOfPaymentStatus"] | null;
  proof_of_payment_storage_key: string | null;
  proof_of_payment_file_url: string | null;
  proof_of_payment_file_name: string | null;
  proof_of_payment_mime_type: string | null;
  proof_of_payment_sent_at: string | null;
  created_at: string;
  updated_at: string;
  start_date: string;
  workout_updated_at: string | null;
  next_workout_change: string | null;
};

type WorkoutTemplateRow = {
  id: string;
  teacher_id: string;
  name: string;
  objective: string | null;
  notes: string | null;
  blocks: unknown;
  created_at: string;
};

type WorkoutPlanRow = {
  id: string;
  teacher_id: string;
  student_id: string;
  training_structure_type: WorkoutPlan["trainingStructureType"];
  training_progress_mode: WorkoutPlan["trainingProgressMode"];
  plan_name: string;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  next_workout_change_date: string | null;
  current_suggested_block_id: string | null;
  last_completed_block_id: string | null;
  last_completed_at: string | null;
  weekly_goal: number | null;
  created_at: string;
  updated_at: string;
  blocks: unknown;
};

type StudentCheckInRow = {
  id: string;
  teacher_id: string;
  student_id: string;
  workout_plan_id: string | null;
  workout_block_id: string | null;
  training_structure_type: StudentCheckIn["trainingStructureType"] | null;
  training_progress_mode: StudentCheckIn["trainingProgressMode"] | null;
  block_label: string | null;
  checked_in_at: string;
  check_in_date: string;
  created_at: string;
  source: StudentCheckIn["source"];
  duration_minutes: number | null;
  notes: string | null;
};

type CoachAlertReadRow = {
  teacher_id: string;
  alert_id: string;
  is_read: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function todayIso() {
  return nowIso().slice(0, 10);
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function asWorkoutBlocks(value: unknown): WorkoutBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as WorkoutBlock[];
}

async function createSignedPaymentProofUrl(storageKey: string | null) {
  if (!storageKey || !hasSupabaseRuntimeConfig()) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(storageKey, 60 * 60);
  if (error) {
    return null;
  }

  return data.signedUrl;
}

async function createPublicStudentPhotoUrl(storageKey: string | null, fallbackUrl: string | null) {
  if (fallbackUrl) {
    return fallbackUrl;
  }

  if (!storageKey || !hasSupabaseRuntimeConfig()) {
    return null;
  }

  const supabase = getSupabaseClient();
  return supabase.storage.from("student-profile-photos").getPublicUrl(storageKey).data.publicUrl;
}

async function uploadStudentPhoto(studentId: string, file: File) {
  const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "png" : "png";
  const storageKey = `${studentId}/avatar.${extension}`;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from("student-profile-photos").upload(storageKey, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    storageKey,
    url: supabase.storage.from("student-profile-photos").getPublicUrl(storageKey).data.publicUrl,
  };
}

async function removeStudentPhoto(storageKey: string | null) {
  if (!storageKey) {
    return;
  }

  const supabase = getSupabaseClient();
  await supabase.storage.from("student-profile-photos").remove([storageKey]);
}

async function uploadPaymentProof(studentId: string, file: File) {
  const safeFileName = file.name.replace(/[^\w.-]+/g, "-");
  const storageKey = `${studentId}/${Date.now()}-${safeFileName}`;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from("payment-proofs").upload(storageKey, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(storageKey, 60 * 60);
  return {
    storageKey,
    signedUrl: data?.signedUrl ?? null,
  };
}

function mapWorkoutTemplate(row: WorkoutTemplateRow): Workout {
  return {
    id: row.id,
    name: row.name,
    objective: row.objective ?? "",
    notes: row.notes ?? "",
    blocks: asWorkoutBlocks(row.blocks),
    createdAt: row.created_at,
  };
}

function mapWorkoutPlan(row: WorkoutPlanRow): WorkoutPlan {
  return {
    id: row.id,
    studentId: row.student_id,
    trainingStructureType: row.training_structure_type,
    trainingProgressMode: row.training_progress_mode,
    planName: row.plan_name,
    isActive: row.is_active,
    startDate: row.start_date,
    endDate: row.end_date,
    nextWorkoutChangeDate: row.next_workout_change_date,
    currentSuggestedBlockId: row.current_suggested_block_id,
    lastCompletedBlockId: row.last_completed_block_id,
    lastCompletedAt: row.last_completed_at,
    weeklyGoal: row.weekly_goal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    blocks: normalizeWorkoutBlocks(asWorkoutBlocks(row.blocks), row.training_structure_type),
  };
}

async function mapStudent(row: StudentRow, plan?: WorkoutPlanRow | null): Promise<Student> {
  const normalizedPlan =
    plan
      ? mapWorkoutPlan(plan)
      : createDefaultWorkoutPlan(
          {
            id: row.id,
            startDate: row.start_date,
            nextWorkoutChange: row.next_workout_change ?? undefined,
            workoutUpdatedAt: row.workout_updated_at ?? undefined,
            workout: [],
          },
          undefined,
        );

  return {
    id: row.id,
    coachId: row.teacher_id,
    userId: row.auth_user_id,
    mustChangePassword: row.must_change_password,
    fullName: row.full_name,
    email: normalizeEmail(row.email ?? ""),
    phone: row.phone ?? "",
    birthDate: row.birth_date ?? row.start_date,
    profilePhotoStorageKey: row.profile_photo_storage_key,
    profilePhotoUrl: await createPublicStudentPhotoUrl(row.profile_photo_storage_key, row.profile_photo_url),
    goal: row.goal ?? "",
    notes: row.notes ?? "",
    accessStatus: row.access_status,
    studentStatus: row.status,
    temporaryPasswordGeneratedAt: row.temporary_password_generated_at,
    firstAccessCompletedAt: row.first_access_completed_at,
    lastLoginAt: row.last_login_at,
    lastCheckInAt: row.last_check_in_at,
    paymentDueDate: row.payment_due_date,
    paymentLastPaidAt: row.payment_last_paid_at,
    proofOfPaymentStatus: row.proof_of_payment_status ?? "not_sent",
    proofOfPaymentStorageKey: row.proof_of_payment_storage_key,
    proofOfPaymentFileUrl: row.proof_of_payment_storage_key
      ? await createSignedPaymentProofUrl(row.proof_of_payment_storage_key)
      : row.proof_of_payment_file_url,
    proofOfPaymentFileName: row.proof_of_payment_file_name,
    proofOfPaymentMimeType: row.proof_of_payment_mime_type,
    proofOfPaymentSentAt: row.proof_of_payment_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startDate: row.start_date,
    workoutPlan: normalizedPlan,
    workout: normalizedPlan.blocks,
    workoutUpdatedAt: row.workout_updated_at ?? undefined,
    nextWorkoutChange: row.next_workout_change ?? undefined,
  };
}

function mapStudentCheckIn(row: StudentCheckInRow): StudentCheckIn {
  return {
    id: row.id,
    studentId: row.student_id,
    workoutPlanId: row.workout_plan_id,
    workoutBlockId: row.workout_block_id,
    trainingStructureType: row.training_structure_type,
    trainingProgressMode: row.training_progress_mode,
    blockLabel: row.block_label,
    checkedInAt: row.checked_in_at,
    checkInDate: row.check_in_date,
    createdAt: row.created_at,
    source: row.source,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
  };
}

export class SupabaseStore {
  private students: Student[] = [];
  private workouts: Workout[] = [];
  private checkIns: StudentCheckIn[] = [];
  private alerts: CoachAlert[] = [];
  private listeners = new Set<Listener>();
  private teacherId: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    void this.refresh();
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  async refresh() {
    if (!hasSupabaseRuntimeConfig()) {
      return;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.loadSnapshot().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async loadSnapshot() {
    const supabase = getSupabaseClient();
    const [
      teacherResult,
      studentsResult,
      workoutsResult,
      plansResult,
      checkInsResult,
      alertReadsResult,
    ] = await Promise.all([
      supabase.from("teachers").select("id").maybeSingle(),
      supabase
        .from("students")
        .select("id,teacher_id,auth_user_id,must_change_password,full_name,email,phone,birth_date,profile_photo_storage_key,profile_photo_url,goal,notes,access_status,status,temporary_password_generated_at,first_access_completed_at,last_login_at,last_check_in_at,payment_due_date,payment_last_paid_at,proof_of_payment_status,proof_of_payment_storage_key,proof_of_payment_file_url,proof_of_payment_file_name,proof_of_payment_mime_type,proof_of_payment_sent_at,created_at,updated_at,start_date,workout_updated_at,next_workout_change")
        .order("created_at", { ascending: false }),
      supabase
        .from("workout_templates")
        .select("id,teacher_id,name,objective,notes,blocks,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("student_workout_plans")
        .select("id,teacher_id,student_id,training_structure_type,training_progress_mode,plan_name,is_active,start_date,end_date,next_workout_change_date,current_suggested_block_id,last_completed_block_id,last_completed_at,weekly_goal,created_at,updated_at,blocks"),
      supabase
        .from("student_check_ins")
        .select("id,teacher_id,student_id,workout_plan_id,workout_block_id,training_structure_type,training_progress_mode,block_label,checked_in_at,check_in_date,created_at,source,duration_minutes,notes")
        .order("checked_in_at", { ascending: false }),
      supabase.from("coach_alert_reads").select("teacher_id,alert_id,is_read"),
    ]);

    this.teacherId = (teacherResult.data?.id as string | undefined) ?? null;

    const plansByStudent = new Map<string, WorkoutPlanRow>();
    for (const plan of (plansResult.data ?? []) as unknown as WorkoutPlanRow[]) {
      plansByStudent.set(plan.student_id, plan);
    }

    this.students = await Promise.all(
      ((studentsResult.data ?? []) as unknown as StudentRow[]).map((row) => mapStudent(row, plansByStudent.get(row.id) ?? null)),
    );
    this.workouts = ((workoutsResult.data ?? []) as unknown as WorkoutTemplateRow[]).map(mapWorkoutTemplate);
    this.checkIns = ((checkInsResult.data ?? []) as unknown as StudentCheckInRow[]).map(mapStudentCheckIn);

    const readsMap = new Map<string, boolean>();
    for (const row of (alertReadsResult.data ?? []) as unknown as CoachAlertReadRow[]) {
      readsMap.set(row.alert_id, row.is_read);
    }

    const alertDrafts = buildCoachAlertDrafts(this.students, this.checkIns);
    this.alerts = alertDrafts.map((draft) => ({
      ...draft,
      isRead: readsMap.get(draft.id) ?? false,
      createdAt: nowIso(),
    }));

    this.notify();
  }

  getStudents() {
    return this.students;
  }

  getCheckIns() {
    return this.checkIns;
  }

  getAlerts() {
    return this.alerts;
  }

  getStudent(id: string) {
    return this.students.find((student) => student.id === id);
  }

  getStudentByUserId(userId?: string | null) {
    if (!userId) return undefined;
    return this.students.find((student) => student.userId === userId);
  }

  getStudentCheckIns(studentId: string) {
    return this.checkIns
      .filter((checkIn) => checkIn.studentId === studentId)
      .sort((left, right) => new Date(right.checkedInAt).getTime() - new Date(left.checkedInAt).getTime());
  }

  private async requireTeacherId() {
    if (this.teacherId) {
      return this.teacherId;
    }

    await this.refresh();
    if (!this.teacherId) {
      throw new Error("Professor autenticado nao encontrado.");
    }

    return this.teacherId;
  }

  private async upsertWorkoutPlan(student: Student, data: Partial<Student>) {
    const supabase = getSupabaseClient();
    const teacherId = await this.requireTeacherId();
    const currentPlan = data.workoutPlan ?? student.workoutPlan ?? createDefaultWorkoutPlan(student);
    const blocks = data.workout ?? currentPlan.blocks;
    const normalizedBlocks = normalizeWorkoutBlocks(blocks, currentPlan.trainingStructureType);

    const payload = {
      teacher_id: teacherId,
      student_id: student.id,
      training_structure_type: currentPlan.trainingStructureType,
      training_progress_mode: currentPlan.trainingProgressMode,
      plan_name: currentPlan.planName,
      is_active: currentPlan.isActive,
      start_date: data.startDate ?? student.startDate,
      end_date: currentPlan.endDate ?? null,
      next_workout_change_date: data.nextWorkoutChange ?? currentPlan.nextWorkoutChangeDate ?? null,
      current_suggested_block_id: currentPlan.currentSuggestedBlockId ?? null,
      last_completed_block_id: currentPlan.lastCompletedBlockId ?? null,
      last_completed_at: currentPlan.lastCompletedAt ?? null,
      weekly_goal: currentPlan.weeklyGoal ?? 4,
      blocks: normalizedBlocks,
    };

    const { error } = await supabase.from("student_workout_plans").upsert(payload, {
      onConflict: "student_id",
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async markCoachAlertRead(alertId: string) {
    const teacherId = await this.requireTeacherId();
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("coach_alert_reads").upsert({
      teacher_id: teacherId,
      alert_id: alertId,
      is_read: true,
    });

    if (error) {
      throw new Error(error.message);
    }

    await this.refresh();
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
    const createdAccess = await teacherAdminActionsService.createStudentWithTemporaryPassword({
      fullName: data.fullName,
      email: normalizeEmail(data.email),
      phone: data.phone || null,
      birthDate: data.birthDate || null,
      goal: data.goal || null,
      notes: data.notes || null,
      startDate: data.startDate,
    });

    await this.refresh();

    if (data.profilePhotoFile) {
      await this.updateStudent(createdAccess.studentId, {
        profilePhotoFile: data.profilePhotoFile,
      });
    }

    const student = this.getStudent(createdAccess.studentId);
    if (!student) {
      throw new Error("Aluno criado, mas nao foi possivel recarregar o snapshot.");
    }
    return student;
  }

  async updateStudent(id: string, data: Partial<Student> & { profilePhotoFile?: File | null; removeProfilePhoto?: boolean }) {
    const supabase = getSupabaseClient();
    const currentStudent = this.getStudent(id);
    if (!currentStudent) return;

    let profilePhotoStorageKey = currentStudent.profilePhotoStorageKey ?? null;
    let profilePhotoUrl = currentStudent.profilePhotoUrl ?? null;

    if (data.removeProfilePhoto) {
      await removeStudentPhoto(profilePhotoStorageKey);
      profilePhotoStorageKey = null;
      profilePhotoUrl = null;
    } else if (data.profilePhotoFile) {
      const uploaded = await uploadStudentPhoto(id, data.profilePhotoFile);
      profilePhotoStorageKey = uploaded.storageKey;
      profilePhotoUrl = uploaded.url;
    }

    const { error } = await supabase
      .from("students")
      .update({
        full_name: data.fullName ?? currentStudent.fullName,
        email: data.email ? normalizeEmail(data.email) : currentStudent.email,
        phone: data.phone ?? currentStudent.phone,
        birth_date: data.birthDate ?? currentStudent.birthDate,
        goal: data.goal ?? currentStudent.goal,
        notes: data.notes ?? currentStudent.notes,
        profile_photo_storage_key: profilePhotoStorageKey,
        profile_photo_url: profilePhotoUrl,
        status: data.studentStatus ?? currentStudent.studentStatus,
        access_status: data.accessStatus ?? currentStudent.accessStatus,
        payment_due_date: data.paymentDueDate ?? currentStudent.paymentDueDate,
        payment_last_paid_at: data.paymentLastPaidAt ?? currentStudent.paymentLastPaidAt,
        proof_of_payment_status: data.proofOfPaymentStatus ?? currentStudent.proofOfPaymentStatus,
        proof_of_payment_storage_key: data.proofOfPaymentStorageKey ?? currentStudent.proofOfPaymentStorageKey,
        proof_of_payment_file_url: data.proofOfPaymentFileUrl ?? currentStudent.proofOfPaymentFileUrl,
        proof_of_payment_file_name: data.proofOfPaymentFileName ?? currentStudent.proofOfPaymentFileName,
        proof_of_payment_mime_type: data.proofOfPaymentMimeType ?? currentStudent.proofOfPaymentMimeType,
        proof_of_payment_sent_at: data.proofOfPaymentSentAt ?? currentStudent.proofOfPaymentSentAt,
        start_date: data.startDate ?? currentStudent.startDate,
        workout_updated_at: data.workoutUpdatedAt ?? currentStudent.workoutUpdatedAt ?? null,
        next_workout_change: data.nextWorkoutChange ?? currentStudent.nextWorkoutChange ?? null,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    if (data.workout || data.workoutPlan) {
      await this.upsertWorkoutPlan(currentStudent, data);
    }

    await this.refresh();
  }

  async provisionStudentAccess(studentId: string, _userId: string, _generatedAt: string) {
    await this.refresh();
  }

  async completeStudentFirstAccess(studentId: string, _completedAt: string) {
    const supabase = getSupabaseClient();
    await supabase.rpc("mark_student_first_access_complete", {
      p_student_id: studentId,
    });
    await this.refresh();
  }

  async resetStudentTemporaryAccess(_studentId: string, _generatedAt: string) {
    await this.refresh();
  }

  async markStudentLastLogin(studentId: string) {
    const supabase = getSupabaseClient();
    await supabase.rpc("touch_student_last_login", {
      p_student_id: studentId,
    });
    await this.refresh();
  }

  async submitProofOfPayment(studentId: string, file: File) {
    const supabase = getSupabaseClient();
    const uploaded = await uploadPaymentProof(studentId, file);
    const { error } = await supabase.rpc("submit_student_payment_proof", {
      p_student_id: studentId,
      p_storage_key: uploaded.storageKey,
      p_file_url: uploaded.signedUrl,
      p_file_name: file.name,
      p_mime_type: file.type,
    });

    if (error) {
      throw new Error(error.message);
    }

    await this.refresh();
  }

  async approveProofOfPayment(studentId: string, paidAt = todayIso()) {
    await this.markPaymentReceived(studentId, paidAt);
  }

  async markPaymentReceived(studentId: string, paidAt = todayIso()) {
    const supabase = getSupabaseClient();
    const nextDueDate = addDays(paidAt, 30);
    const { error } = await supabase
      .from("students")
      .update({
        payment_last_paid_at: paidAt,
        payment_due_date: nextDueDate,
        proof_of_payment_status: "approved",
      })
      .eq("id", studentId);

    if (error) {
      throw new Error(error.message);
    }

    await this.refresh();
  }

  async updatePaymentDueDate(studentId: string, dueDate: string) {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("students")
      .update({
        payment_due_date: dueDate,
      })
      .eq("id", studentId);

    if (error) {
      throw new Error(error.message);
    }

    await this.refresh();
  }

  async registerStudentCheckIn(studentId: string, workoutBlockId?: string | null, source: "student" | "coach" = "student", notes?: string | null) {
    const supabase = getSupabaseClient();
    const student = this.getStudent(studentId);
    if (!student) {
      throw new Error("Aluno nao encontrado.");
    }

    if (isWorkoutBlockedByPayment(student)) {
      throw new Error("Os treinos estao bloqueados por inadimplencia.");
    }

    const plan = getStudentWorkoutPlan(student);
    const timestamp = nowIso();
    const checkInDate = timestamp.slice(0, 10);

    const { error: assertError } = await supabase.rpc("assert_student_can_check_in", {
      p_student_id: studentId,
      p_teacher_id: student.coachId,
      p_check_in_date: checkInDate,
    });

    if (assertError) {
      throw new Error(assertError.message);
    }

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
        block_label: block ? getBlockDisplayLabel(block, plan) : null,
        checked_in_at: timestamp,
        check_in_date: checkInDate,
        source,
        notes: notes ?? null,
      })
      .select("id,teacher_id,student_id,workout_plan_id,workout_block_id,training_structure_type,training_progress_mode,block_label,checked_in_at,check_in_date,created_at,source,duration_minutes,notes")
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message ?? "Nao foi possivel registrar o check-in.");
    }

    const nextSuggestedBlock =
      plan.trainingProgressMode === "sequential_progression"
        ? getNextSuggestedBlock(
            {
              ...plan,
              currentSuggestedBlockId: null,
              lastCompletedBlockId: block?.id ?? plan.lastCompletedBlockId ?? null,
              lastCompletedAt: timestamp,
            },
            [mapStudentCheckIn(data as unknown as StudentCheckInRow), ...this.checkIns],
          )
        : null;

    await supabase
      .from("student_workout_plans")
      .update({
        last_completed_block_id: block?.id ?? plan.lastCompletedBlockId ?? null,
        last_completed_at: timestamp,
        current_suggested_block_id: nextSuggestedBlock?.id ?? plan.currentSuggestedBlockId ?? null,
      })
      .eq("id", plan.id);

    await this.refresh();
    return mapStudentCheckIn(data as unknown as StudentCheckInRow);
  }

  async updateStudentExerciseLoad(studentId: string, blockId: string, exerciseId: string, studentLoad: string) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("update_student_exercise_load", {
      p_student_id: studentId,
      p_block_id: blockId,
      p_exercise_id: exerciseId,
      p_student_load: studentLoad.trim(),
    });

    if (error) {
      throw new Error(error.message);
    }

    await this.refresh();
  }

  async setStudentLifecycle(studentId: string, active: boolean) {
    await teacherAdminActionsService.setStudentStatus(studentId, active);
    await this.refresh();
  }

  async deleteStudent(id: string) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }

    await this.refresh();
  }

  async importWorkoutToStudent(studentId: string, workoutId: string) {
    const workout = this.workouts.find((item) => item.id === workoutId);
    if (!workout) return;

    const newBlocks = workout.blocks.map((block) => ({
      ...block,
      id: generateId(),
      exercises: block.exercises.map((exercise) => ({
        ...exercise,
        id: generateId(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])],
      })),
    }));

    const student = this.getStudent(studentId);
    if (!student) return;
    const currentPlan = getStudentWorkoutPlan(student);

    await this.updateStudent(studentId, {
      workout: newBlocks,
      workoutUpdatedAt: todayIso(),
      workoutPlan: {
        ...currentPlan,
        blocks: normalizeWorkoutBlocks(newBlocks, currentPlan.trainingStructureType),
        currentSuggestedBlockId: normalizeWorkoutBlocks(newBlocks, currentPlan.trainingStructureType).find((block) => !block.isRestDay)?.id ?? null,
        updatedAt: nowIso(),
      },
    });
  }

  getWorkouts() {
    return this.workouts;
  }

  getWorkout(id: string) {
    return this.workouts.find((workout) => workout.id === id);
  }

  async addWorkout(data: Omit<Workout, "id" | "createdAt">) {
    const supabase = getSupabaseClient();
    const teacherId = await this.requireTeacherId();
    const { data: workout, error } = await supabase
      .from("workout_templates")
      .insert({
        teacher_id: teacherId,
        name: data.name,
        objective: data.objective,
        notes: data.notes,
        blocks: data.blocks,
      })
      .select("id,teacher_id,name,objective,notes,blocks,created_at")
      .maybeSingle();

    if (error || !workout) {
      throw new Error(error?.message ?? "Nao foi possivel criar o treino.");
    }

    await this.refresh();
    return mapWorkoutTemplate(workout as unknown as WorkoutTemplateRow);
  }

  async updateWorkout(id: string, data: Partial<Workout>) {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("workout_templates")
      .update({
        name: data.name,
        objective: data.objective,
        notes: data.notes,
        blocks: data.blocks,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    await this.refresh();
  }

  async deleteWorkout(id: string) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("workout_templates").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }

    await this.refresh();
  }

  async duplicateWorkout(id: string) {
    const workout = this.workouts.find((item) => item.id === id);
    if (!workout) return;

    const duplicate: Omit<Workout, "id" | "createdAt"> = {
      ...workout,
      name: `${workout.name} (copia)`,
      blocks: workout.blocks.map((block) => ({
        ...block,
        id: generateId(),
        exercises: block.exercises.map((exercise) => ({
          ...exercise,
          id: generateId(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])],
        })),
      })),
    };

    return this.addWorkout(duplicate);
  }
}

export const supabaseStore = new SupabaseStore();
