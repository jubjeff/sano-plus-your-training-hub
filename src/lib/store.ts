import { normalizeEmail } from "@/lib/auth-validators";
import { loadPersistedExerciseVideo } from "@/lib/exercise-media";
import { persistPaymentProofFile, loadPaymentProofFile, removePaymentProofFile } from "@/lib/payment-proof";
import { loadPersistedProfileImage, persistProfileImageFile } from "@/lib/profile-media";
import { createEmptyExercise } from "@/lib/exercise-utils";
import {
  buildCoachAlertDrafts,
  createDefaultWorkoutPlan,
  getBlockDisplayLabel,
  getNextSuggestedBlock,
  getStudentWorkoutPlan,
  normalizeProgressMode,
  normalizeWorkoutBlocks,
} from "@/lib/training-management";
import { isWorkoutBlockedByPayment } from "@/lib/student-dashboard";
import type { CoachAlert, Student, StudentCheckIn, Workout, WorkoutBlock, WorkoutPlan } from "@/types";

type PersistedState = {
  students: Student[];
  workouts: Workout[];
  checkIns: StudentCheckIn[];
  alerts: CoachAlert[];
};

type PersistedStudentLike = Partial<Student> & {
  name?: string;
  objective?: string;
  avatarUrl?: string | null;
  active?: boolean;
};

type PersistedCheckInLike = Partial<StudentCheckIn>;

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

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

const today = new Date();

const daysAgo = (days: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
};

const daysFromNow = (days: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

function buildExercise(overrides: Partial<ReturnType<typeof createEmptyExercise>>) {
  return {
    ...createEmptyExercise(),
    ...overrides,
  };
}

function syncLegacyWorkoutFromPlan(workoutPlan: WorkoutPlan | null | undefined, legacyWorkout: WorkoutBlock[]) {
  if (workoutPlan?.blocks?.length) {
    return workoutPlan.blocks;
  }

  return legacyWorkout;
}

const STORE_STORAGE_KEY = "sano-plus-store";

const initialStudents: Student[] = [
  {
    id: "s1",
    coachId: "seed-coach",
    userId: null,
    fullName: "Lucas Oliveira",
    phone: "11987654321",
    email: "lucas@email.com",
    birthDate: "1994-05-12",
    goal: "Hipertrofia",
    notes: "Lesao no ombro esquerdo. Evitar supino reto pesado nas proximas semanas.",
    accessStatus: "pre_registered",
    studentStatus: "active",
    temporaryPasswordGeneratedAt: null,
    firstAccessCompletedAt: null,
    lastLoginAt: null,
    lastCheckInAt: null,
    paymentDueDate: daysFromNow(4),
    paymentLastPaidAt: daysAgo(26),
    proofOfPaymentStatus: "not_sent",
    proofOfPaymentStorageKey: null,
    proofOfPaymentFileUrl: null,
    proofOfPaymentFileName: null,
    proofOfPaymentMimeType: null,
    proofOfPaymentSentAt: null,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(10),
    startDate: daysAgo(90),
    workoutUpdatedAt: daysAgo(25),
    nextWorkoutChange: daysFromNow(5),
    workout: [
      {
        id: "b1",
        name: "Treino A - Peito e Triceps",
        exercises: [
          buildExercise({
            id: "e1",
            name: "Supino inclinado com halteres",
            description: "Desca com controle, mantenha as escapulas apoiadas e finalize sem perder a linha do punho.",
            sets: 4,
            reps: "10-12",
            load: "24kg",
            rest: "90s",
            muscleCategory: "Peito",
            muscleGroupPrimary: "Peitoral maior",
            muscleGroupsSecondary: ["Deltoide anterior", "Triceps braquial"],
            equipment: "Halteres",
          }),
        ],
      },
    ],
  },
  {
    id: "s2",
    coachId: "seed-coach",
    userId: null,
    fullName: "Ana Carolina Santos",
    phone: "11912345678",
    email: "ana@email.com",
    birthDate: "1996-10-21",
    goal: "Emagrecimento",
    notes: "Priorizar progressao gradual e aderencia semanal.",
    accessStatus: "temporary_password_pending",
    studentStatus: "active",
    temporaryPasswordGeneratedAt: daysAgo(1),
    firstAccessCompletedAt: null,
    lastLoginAt: null,
    lastCheckInAt: `${daysAgo(2)}T18:20:00.000Z`,
    paymentDueDate: daysAgo(4),
    paymentLastPaidAt: daysAgo(34),
    proofOfPaymentStatus: "not_sent",
    proofOfPaymentStorageKey: null,
    proofOfPaymentFileUrl: null,
    proofOfPaymentFileName: null,
    proofOfPaymentMimeType: null,
    proofOfPaymentSentAt: null,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(1),
    startDate: daysAgo(30),
    workoutUpdatedAt: daysAgo(28),
    nextWorkoutChange: daysFromNow(2),
    workout: [
      {
        id: "b3",
        name: "Treino A - Full Body",
        exercises: [
          buildExercise({
            id: "e6",
            name: "Agachamento livre",
            description: "Inicie o movimento levando o quadril para tras, mantenha o tronco firme e distribua a carga no pe inteiro.",
            sets: 4,
            reps: "12",
            load: "30kg",
            rest: "60s",
            muscleCategory: "Quadriceps",
            muscleGroupPrimary: "Quadriceps",
            muscleGroupsSecondary: ["Gluteo maximo", "Core"],
            equipment: "Barra",
          }),
        ],
      },
    ],
  },
  {
    id: "s3",
    coachId: "seed-coach",
    userId: null,
    fullName: "Pedro Henrique Costa",
    phone: "21998765432",
    email: "pedro@email.com",
    birthDate: "1992-02-08",
    goal: "Ganho de forca",
    notes: "Treina 5x por semana e responde bem a progressoes lineares.",
    accessStatus: "inactive",
    studentStatus: "inactive",
    temporaryPasswordGeneratedAt: null,
    firstAccessCompletedAt: null,
    lastLoginAt: null,
    lastCheckInAt: null,
    paymentDueDate: daysAgo(1),
    paymentLastPaidAt: daysAgo(31),
    proofOfPaymentStatus: "submitted",
    proofOfPaymentStorageKey: null,
    proofOfPaymentFileUrl: null,
    proofOfPaymentFileName: "comprovante-pedro.pdf",
    proofOfPaymentMimeType: "application/pdf",
    proofOfPaymentSentAt: daysAgo(1),
    createdAt: daysAgo(180),
    updatedAt: daysAgo(7),
    startDate: daysAgo(180),
    workoutUpdatedAt: daysAgo(10),
    nextWorkoutChange: daysFromNow(20),
    workout: [],
  },
];

const initialCheckIns: StudentCheckIn[] = [
  { id: "c1", studentId: "s1", workoutBlockId: "b1", checkedInAt: `${daysAgo(1)}T07:40:00.000Z`, createdAt: `${daysAgo(1)}T07:40:00.000Z`, source: "student" },
  { id: "c2", studentId: "s1", workoutBlockId: "b1", checkedInAt: `${daysAgo(3)}T08:10:00.000Z`, createdAt: `${daysAgo(3)}T08:10:00.000Z`, source: "student" },
  { id: "c3", studentId: "s2", workoutBlockId: "b3", checkedInAt: `${daysAgo(2)}T18:20:00.000Z`, createdAt: `${daysAgo(2)}T18:20:00.000Z`, source: "student" },
  { id: "c4", studentId: "s2", workoutBlockId: "b3", checkedInAt: `${daysAgo(7)}T18:05:00.000Z`, createdAt: `${daysAgo(7)}T18:05:00.000Z`, source: "student" },
];

const initialWorkouts: Workout[] = [
  {
    id: "w1",
    name: "Treino Hipertrofia Iniciante",
    objective: "Hipertrofia",
    notes: "Treino base para alunos iniciantes com foco em hipertrofia muscular.",
    createdAt: daysAgo(60),
    blocks: [
      {
        id: "wb1",
        name: "Treino A - Superior",
        exercises: [
          buildExercise({
            id: "we1",
            name: "Supino reto com barra",
            description: "Desca a barra com controle ate a linha media do peito e mantenha os pes firmes no chao.",
            sets: 4,
            reps: "8-10",
            load: "-",
            rest: "90s",
            muscleCategory: "Peito",
            muscleGroupPrimary: "Peitoral maior",
            muscleGroupsSecondary: ["Deltoide anterior", "Triceps braquial"],
            equipment: "Barra",
          }),
        ],
      },
    ],
  },
];

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeStudent(student: PersistedStudentLike): Student {
  const startDate = student.startDate ?? todayIso();
  const workoutPlan = createDefaultWorkoutPlan(
    {
      id: student.id,
      startDate,
      nextWorkoutChange: student.nextWorkoutChange,
      workoutUpdatedAt: student.workoutUpdatedAt,
      workout: student.workout ?? student.workoutPlan?.blocks ?? [],
    },
    student.workoutPlan
      ? {
          ...student.workoutPlan,
          trainingProgressMode: normalizeProgressMode(
            student.workoutPlan.trainingStructureType ?? "weekly",
            student.workoutPlan.trainingProgressMode,
          ),
          blocks: normalizeWorkoutBlocks(
            student.workoutPlan.blocks ?? student.workout ?? [],
            student.workoutPlan.trainingStructureType ?? "weekly",
          ),
        }
      : undefined,
  );

  return {
    id: student.id,
    coachId: student.coachId ?? "seed-coach",
    userId: student.userId ?? null,
    mustChangePassword: student.mustChangePassword ?? (student.accessStatus !== "active"),
    fullName: student.fullName ?? student.name ?? "",
    email: normalizeEmail(student.email ?? ""),
    phone: student.phone ?? "",
    birthDate: student.birthDate ?? startDate,
    profilePhotoUrl: student.profilePhotoUrl ?? student.avatarUrl ?? null,
    profilePhotoStorageKey: student.profilePhotoStorageKey ?? null,
    goal: student.goal ?? student.objective ?? "",
    notes: student.notes ?? "",
    accessStatus: student.accessStatus ?? (student.active === false ? "inactive" : "pre_registered"),
    studentStatus: student.studentStatus ?? (student.active === false ? "inactive" : "active"),
    temporaryPasswordGeneratedAt: student.temporaryPasswordGeneratedAt ?? null,
    firstAccessCompletedAt: student.firstAccessCompletedAt ?? null,
    lastLoginAt: student.lastLoginAt ?? null,
    lastCheckInAt: student.lastCheckInAt ?? null,
    paymentDueDate: student.paymentDueDate ?? addDays(startDate, 30),
    paymentLastPaidAt: student.paymentLastPaidAt ?? null,
    proofOfPaymentStatus: student.proofOfPaymentStatus ?? "not_sent",
    proofOfPaymentStorageKey: student.proofOfPaymentStorageKey ?? null,
    proofOfPaymentFileUrl: student.proofOfPaymentFileUrl ?? null,
    proofOfPaymentFileName: student.proofOfPaymentFileName ?? null,
    proofOfPaymentMimeType: student.proofOfPaymentMimeType ?? null,
    proofOfPaymentSentAt: student.proofOfPaymentSentAt ?? null,
    createdAt: student.createdAt ?? startDate,
    updatedAt: student.updatedAt ?? nowIso(),
    startDate,
    workoutPlan,
    workout: syncLegacyWorkoutFromPlan(workoutPlan, student.workout ?? []),
    workoutUpdatedAt: student.workoutUpdatedAt,
    nextWorkoutChange: student.nextWorkoutChange,
  };
}

function normalizeCheckIn(checkIn: PersistedCheckInLike): StudentCheckIn {
  return {
    id: checkIn.id,
    studentId: checkIn.studentId,
    workoutPlanId: checkIn.workoutPlanId ?? null,
    workoutBlockId: checkIn.workoutBlockId ?? null,
    trainingStructureType: checkIn.trainingStructureType ?? null,
    trainingProgressMode: checkIn.trainingProgressMode ?? null,
    blockLabel: checkIn.blockLabel ?? null,
    checkedInAt: checkIn.checkedInAt ?? checkIn.createdAt ?? nowIso(),
    checkInDate: checkIn.checkInDate ?? (checkIn.checkedInAt ?? checkIn.createdAt ?? nowIso()).split("T")[0],
    createdAt: checkIn.createdAt ?? checkIn.checkedInAt ?? nowIso(),
    source: checkIn.source ?? "student",
    durationMinutes: checkIn.durationMinutes ?? null,
    notes: checkIn.notes ?? null,
  };
}

function loadPersistedState() {
  if (!canUseBrowserStorage()) return null;

  try {
    const raw = window.localStorage.getItem(STORE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      students: Array.isArray(parsed.students) ? parsed.students.map(normalizeStudent) : [],
      workouts: Array.isArray(parsed.workouts) ? (parsed.workouts as Workout[]) : [],
      checkIns: Array.isArray(parsed.checkIns) ? parsed.checkIns.map(normalizeCheckIn) : [],
      alerts: Array.isArray(parsed.alerts) ? (parsed.alerts as CoachAlert[]) : [],
    };
  } catch {
    return null;
  }
}

function persistState(students: Student[], workouts: Workout[], checkIns: StudentCheckIn[], alerts: CoachAlert[]) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify({ students, workouts, checkIns, alerts }));
}

async function hydrateBlockVideos(blocks: WorkoutBlock[]) {
  return Promise.all(
    blocks.map(async (block) => ({
      ...block,
      exercises: await Promise.all(
        block.exercises.map(async (exercise) => ({
          ...exercise,
          muscleGroupsSecondary: [...(exercise.muscleGroupsSecondary ?? [])],
          videoFileUrl:
            exercise.videoStorageKey
              ? await loadPersistedExerciseVideo(exercise.videoStorageKey).catch(() => null)
              : exercise.videoFileUrl && !exercise.videoFileUrl.startsWith("blob:")
              ? exercise.videoFileUrl
              : null,
        })),
      ),
    })),
  );
}

type Listener = () => void;

class Store {
  private students: Student[] = loadPersistedState()?.students ?? [...initialStudents];
  private workouts: Workout[] = loadPersistedState()?.workouts ?? [...initialWorkouts];
  private checkIns: StudentCheckIn[] = loadPersistedState()?.checkIns ?? [...initialCheckIns];
  private alerts: CoachAlert[] = loadPersistedState()?.alerts ?? [];
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.syncCoachAlerts();
    void this.hydrateMedia();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.syncCoachAlerts();
    persistState(this.students, this.workouts, this.checkIns, this.alerts);
    this.listeners.forEach((listener) => listener());
  }

  private syncCoachAlerts() {
    const drafts = buildCoachAlertDrafts(this.students, this.checkIns);
    const nextTimestamp = nowIso();

    this.alerts = drafts.map((draft) => {
      const current = this.alerts.find((alert) => alert.id === draft.id);
      return {
        ...draft,
        isRead: current?.isRead ?? false,
        createdAt: current?.createdAt ?? nextTimestamp,
      };
    });
  }

  private async hydrateMedia() {
    const [students, workouts] = await Promise.all([
      Promise.all(
        this.students.map(async (student) => ({
          ...student,
          profilePhotoUrl:
            student.profilePhotoUrl ||
            (student.profilePhotoStorageKey ? await loadPersistedProfileImage(student.profilePhotoStorageKey).catch(() => null) : null),
          proofOfPaymentFileUrl:
            student.proofOfPaymentFileUrl ||
            (student.proofOfPaymentStorageKey
              ? await loadPaymentProofFile(student.proofOfPaymentStorageKey)
                  .then((file) => (file ? URL.createObjectURL(file) : null))
                  .catch(() => null)
              : null),
          workoutPlan: student.workoutPlan
            ? {
                ...student.workoutPlan,
                blocks: await hydrateBlockVideos(student.workoutPlan.blocks),
              }
            : null,
          workout: await hydrateBlockVideos(student.workoutPlan?.blocks ?? student.workout),
        })),
      ),
      Promise.all(
        this.workouts.map(async (workout) => ({
          ...workout,
          blocks: await hydrateBlockVideos(workout.blocks),
        })),
      ),
    ]);

    this.students = students;
    this.workouts = workouts;
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

  markCoachAlertRead(alertId: string) {
    this.alerts = this.alerts.map((alert) => (alert.id === alertId ? { ...alert, isRead: true } : alert));
    this.notify();
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
    const normalizedEmail = normalizeEmail(data.email);
    if (this.students.some((student) => student.email === normalizedEmail)) {
      throw new Error("Ja existe um aluno com este e-mail.");
    }

    const createdAt = nowIso();
    let profilePhotoStorageKey: string | null = null;
    let profilePhotoUrl: string | null = null;

    if (data.profilePhotoFile) {
      profilePhotoStorageKey = await persistProfileImageFile(data.profilePhotoFile);
      profilePhotoUrl = await loadPersistedProfileImage(profilePhotoStorageKey).catch(() => null);
    }

    const student: Student = {
      id: generateId(),
      coachId: data.coachId,
      userId: null,
      mustChangePassword: true,
      fullName: data.fullName,
      email: normalizedEmail,
      phone: data.phone,
      birthDate: data.birthDate,
      profilePhotoStorageKey,
      profilePhotoUrl,
      goal: data.goal,
      notes: data.notes,
      accessStatus: "pre_registered",
      studentStatus: "active",
      temporaryPasswordGeneratedAt: null,
      firstAccessCompletedAt: null,
      lastLoginAt: null,
      lastCheckInAt: null,
      paymentDueDate: addDays(data.startDate, 30),
      paymentLastPaidAt: null,
      proofOfPaymentStatus: "not_sent",
      proofOfPaymentStorageKey: null,
      proofOfPaymentFileUrl: null,
      proofOfPaymentFileName: null,
      proofOfPaymentMimeType: null,
      proofOfPaymentSentAt: null,
      createdAt,
      updatedAt: createdAt,
      startDate: data.startDate,
      workoutPlan: null,
      workout: [],
    };

    student.workoutPlan = createDefaultWorkoutPlan(student);

    this.students = [student, ...this.students];
    this.notify();
    return student;
  }

  async updateStudent(id: string, data: Partial<Student> & { profilePhotoFile?: File | null; removeProfilePhoto?: boolean }) {
    const currentStudent = this.students.find((student) => student.id === id);
    if (!currentStudent) return;

    const nextEmail = data.email ? normalizeEmail(data.email) : currentStudent.email;
    if (nextEmail !== currentStudent.email && this.students.some((student) => student.id !== id && student.email === nextEmail)) {
      throw new Error("Ja existe um aluno com este e-mail.");
    }

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

    this.students = this.students.map((student) => {
      if (student.id !== id) return student;

      const nextTimestamp = nowIso();
      const currentPlan = getStudentWorkoutPlan(student);
      const incomingPlan = data.workoutPlan
        ? createDefaultWorkoutPlan(
            {
              id: student.id,
              startDate: data.startDate ?? student.startDate,
              nextWorkoutChange: data.nextWorkoutChange ?? student.nextWorkoutChange,
              workoutUpdatedAt: data.workoutUpdatedAt ?? student.workoutUpdatedAt,
              workout: data.workout ?? student.workout,
            },
            data.workoutPlan,
          )
        : null;

      const nextPlan =
        incomingPlan ??
        createDefaultWorkoutPlan(
          {
            id: student.id,
            startDate: data.startDate ?? student.startDate,
            nextWorkoutChange: data.nextWorkoutChange ?? student.nextWorkoutChange,
            workoutUpdatedAt: data.workoutUpdatedAt ?? student.workoutUpdatedAt,
            workout: data.workout ?? student.workout,
          },
          {
            ...currentPlan,
            blocks: normalizeWorkoutBlocks(data.workout ?? currentPlan.blocks, currentPlan.trainingStructureType),
            nextWorkoutChangeDate: data.nextWorkoutChange ?? currentPlan.nextWorkoutChangeDate,
          },
        );

      return {
        ...student,
        ...data,
        email: nextEmail,
        profilePhotoStorageKey,
        profilePhotoUrl,
        workoutPlan: nextPlan,
        workout: nextPlan.blocks,
        nextWorkoutChange: nextPlan.nextWorkoutChangeDate ?? data.nextWorkoutChange ?? student.nextWorkoutChange,
        updatedAt: nextTimestamp,
      };
    });
    this.notify();
  }

  provisionStudentAccess(studentId: string, userId: string, generatedAt: string) {
    this.students = this.students.map((student) =>
      student.id === studentId
        ? {
            ...student,
            userId,
            mustChangePassword: true,
            accessStatus: "temporary_password_pending",
            studentStatus: "active",
            temporaryPasswordGeneratedAt: generatedAt,
            firstAccessCompletedAt: null,
            updatedAt: generatedAt,
          }
        : student,
    );
    this.notify();
  }

  completeStudentFirstAccess(studentId: string, completedAt: string) {
    this.students = this.students.map((student) =>
      student.id === studentId
        ? {
            ...student,
            accessStatus: "active",
            mustChangePassword: false,
            firstAccessCompletedAt: completedAt,
            updatedAt: completedAt,
          }
        : student,
    );
    this.notify();
  }

  resetStudentTemporaryAccess(studentId: string, generatedAt: string) {
    this.students = this.students.map((student) =>
      student.id === studentId
        ? {
            ...student,
            accessStatus: "temporary_password_pending",
            mustChangePassword: true,
            temporaryPasswordGeneratedAt: generatedAt,
            firstAccessCompletedAt: null,
            updatedAt: generatedAt,
          }
        : student,
    );
    this.notify();
  }

  markStudentLastLogin(studentId: string) {
    const timestamp = nowIso();
    this.students = this.students.map((student) =>
      student.id === studentId ? { ...student, lastLoginAt: timestamp, updatedAt: timestamp } : student,
    );
    this.notify();
  }

  async submitProofOfPayment(studentId: string, file: File) {
    const student = this.students.find((item) => item.id === studentId);
    if (!student) throw new Error("Aluno nao encontrado.");

    const storageKey = await persistPaymentProofFile(file, student.proofOfPaymentStorageKey);
    const storedFile = await loadPaymentProofFile(storageKey).catch(() => null);
    const fileUrl = storedFile ? URL.createObjectURL(storedFile) : null;
    const sentAt = nowIso();

    this.students = this.students.map((item) =>
      item.id === studentId
        ? {
            ...item,
            proofOfPaymentStatus: "submitted",
            proofOfPaymentStorageKey: storageKey,
            proofOfPaymentFileUrl: fileUrl,
            proofOfPaymentFileName: file.name,
            proofOfPaymentMimeType: file.type,
            proofOfPaymentSentAt: sentAt,
            updatedAt: sentAt,
          }
        : item,
    );
    this.notify();
  }

  approveProofOfPayment(studentId: string, paidAt = todayIso()) {
    this.students = this.students.map((student) =>
      student.id === studentId
        ? {
            ...student,
            paymentLastPaidAt: paidAt,
            paymentDueDate: addDays(paidAt, 30),
            proofOfPaymentStatus: "approved",
            updatedAt: nowIso(),
          }
        : student,
    );
    this.notify();
  }

  markPaymentReceived(studentId: string, paidAt = todayIso()) {
    this.students = this.students.map((student) =>
      student.id === studentId
        ? {
            ...student,
            paymentLastPaidAt: paidAt,
            paymentDueDate: addDays(paidAt, 30),
            proofOfPaymentStatus: student.proofOfPaymentStatus === "submitted" ? "approved" : student.proofOfPaymentStatus,
            updatedAt: nowIso(),
          }
        : student,
    );
    this.notify();
  }

  updatePaymentDueDate(studentId: string, dueDate: string) {
    this.students = this.students.map((student) =>
      student.id === studentId ? { ...student, paymentDueDate: dueDate, updatedAt: nowIso() } : student,
    );
    this.notify();
  }

  registerStudentCheckIn(studentId: string, workoutBlockId?: string | null, source: "student" | "coach" = "student", notes?: string | null) {
    const student = this.students.find((item) => item.id === studentId);
    if (!student) {
      throw new Error("Aluno nao encontrado.");
    }

    if (isWorkoutBlockedByPayment(student)) {
      throw new Error("Os treinos estao bloqueados por inadimplencia.");
    }

    const plan = getStudentWorkoutPlan(student);
    const block = workoutBlockId ? plan.blocks.find((item) => item.id === workoutBlockId) : null;
    const timestamp = nowIso();
    const checkInDate = timestamp.split("T")[0];

    const alreadyCheckedIn = this.checkIns.some(
      (checkIn) =>
        checkIn.studentId === studentId &&
        checkIn.workoutBlockId === (workoutBlockId ?? null) &&
        (checkIn.checkInDate ?? checkIn.checkedInAt.split("T")[0]) === checkInDate,
    );

    if (alreadyCheckedIn) {
      throw new Error("Este treino ja recebeu check-in hoje.");
    }

    const checkIn: StudentCheckIn = {
      id: generateId(),
      studentId,
      workoutPlanId: plan.id,
      workoutBlockId: workoutBlockId ?? null,
      trainingStructureType: plan.trainingStructureType,
      trainingProgressMode: plan.trainingProgressMode,
      blockLabel: block ? getBlockDisplayLabel(block, plan) : null,
      checkedInAt: timestamp,
      checkInDate,
      createdAt: timestamp,
      source,
      durationMinutes: null,
      notes: notes ?? null,
    };

    this.checkIns = [checkIn, ...this.checkIns];
    this.students = this.students.map((item) => {
      if (item.id !== studentId) return item;

      const currentPlan = getStudentWorkoutPlan(item);
      const nextSuggestedBlock = currentPlan.trainingProgressMode === "sequential_progression" ? getNextSuggestedBlock({
        ...currentPlan,
        currentSuggestedBlockId: null,
        lastCompletedBlockId: block?.id ?? currentPlan.lastCompletedBlockId ?? null,
        lastCompletedAt: timestamp,
      }, [checkIn, ...this.checkIns]) : null;

      const nextPlan = {
        ...currentPlan,
        lastCompletedBlockId: block?.id ?? currentPlan.lastCompletedBlockId ?? null,
        lastCompletedAt: timestamp,
        currentSuggestedBlockId: nextSuggestedBlock?.id ?? currentPlan.currentSuggestedBlockId ?? null,
        updatedAt: timestamp,
      };

      return {
        ...item,
        lastCheckInAt: timestamp,
        updatedAt: timestamp,
        workoutPlan: nextPlan,
        workout: nextPlan.blocks,
      };
    });
    this.notify();
    return checkIn;
  }

  updateStudentExerciseLoad(studentId: string, blockId: string, exerciseId: string, studentLoad: string) {
    const timestamp = nowIso();
    this.students = this.students.map((student) => {
      if (student.id !== studentId) return student;

      return {
        ...student,
        updatedAt: timestamp,
        workout: student.workout.map((block) =>
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
                        updatedAt: timestamp,
                      },
                ),
              },
        ),
      };
    });
    this.notify();
  }

  setStudentLifecycle(studentId: string, active: boolean) {
    this.students = this.students.map((student) => {
      if (student.id !== studentId) return student;
      const studentStatus = active ? "active" : "inactive";
      const accessStatus = active
        ? student.userId
          ? student.firstAccessCompletedAt
            ? "active"
            : "temporary_password_pending"
          : "pre_registered"
        : "inactive";
      return {
        ...student,
        studentStatus,
        accessStatus,
        updatedAt: nowIso(),
      };
    });
    this.notify();
  }

  deleteStudent(id: string) {
    this.students = this.students.filter((student) => student.id !== id);
    this.checkIns = this.checkIns.filter((checkIn) => checkIn.studentId !== id);
    this.notify();
  }

  importWorkoutToStudent(studentId: string, workoutId: string) {
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

    const student = this.students.find((item) => item.id === studentId);
    if (!student) return;
    const currentPlan = getStudentWorkoutPlan(student);
    const workoutUpdatedAt = todayIso();

    void this.updateStudent(studentId, {
      workout: newBlocks,
      workoutUpdatedAt,
      workoutPlan: {
        ...currentPlan,
        blocks: normalizeWorkoutBlocks(newBlocks, currentPlan.trainingStructureType),
        currentSuggestedBlockId: normalizeWorkoutBlocks(newBlocks, currentPlan.trainingStructureType).find((block) => !block.isRestDay)?.id ?? null,
        updatedAt: workoutUpdatedAt,
      },
    });
  }

  getWorkouts() {
    return this.workouts;
  }

  getWorkout(id: string) {
    return this.workouts.find((workout) => workout.id === id);
  }

  addWorkout(data: Omit<Workout, "id" | "createdAt">) {
    const workout: Workout = { ...data, id: generateId(), createdAt: todayIso() };
    this.workouts = [workout, ...this.workouts];
    this.notify();
    return workout;
  }

  updateWorkout(id: string, data: Partial<Workout>) {
    this.workouts = this.workouts.map((workout) => (workout.id === id ? { ...workout, ...data } : workout));
    this.notify();
  }

  deleteWorkout(id: string) {
    this.workouts = this.workouts.filter((workout) => workout.id !== id);
    this.notify();
  }

  duplicateWorkout(id: string) {
    const workout = this.workouts.find((item) => item.id === id);
    if (!workout) return;

    const duplicate: Workout = {
      ...workout,
      id: generateId(),
      name: `${workout.name} (copia)`,
      createdAt: todayIso(),
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

    this.workouts = [duplicate, ...this.workouts];
    this.notify();
    return duplicate;
  }
}

export const store = new Store();
