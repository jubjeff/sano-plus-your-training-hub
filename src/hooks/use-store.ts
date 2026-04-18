import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/auth/use-auth";
import { store as localStore } from "@/lib/store";
import { supabaseStore } from "@/lib/supabase-store";
import { hasSupabaseRuntimeConfig } from "@/integrations/supabase/client";
import type { Student, Workout, StudentCheckIn, CoachAlert } from "@/types";

interface StoreSnapshot {
  students: Student[];
  workouts: Workout[];
  checkIns: StudentCheckIn[];
  alerts: CoachAlert[];
}

type StoreLike = typeof localStore & {
  refresh?: () => Promise<void>;
};

let cachedSnapshot: StoreSnapshot | null = null;

function getActiveStore() {
  return (hasSupabaseRuntimeConfig() ? supabaseStore : localStore) as StoreLike;
}

function subscribe(cb: () => void) {
  return getActiveStore().subscribe(cb);
}

function getSnapshot(): StoreSnapshot {
  const activeStore = getActiveStore();
  const nextStudents = activeStore.getStudents();
  const nextWorkouts = activeStore.getWorkouts();
  const nextCheckIns = activeStore.getCheckIns();
  const nextAlerts = activeStore.getAlerts();

  if (
    cachedSnapshot &&
    cachedSnapshot.students === nextStudents &&
    cachedSnapshot.workouts === nextWorkouts &&
    cachedSnapshot.checkIns === nextCheckIns &&
    cachedSnapshot.alerts === nextAlerts
  ) {
    return cachedSnapshot;
  }

  cachedSnapshot = {
    students: nextStudents,
    workouts: nextWorkouts,
    checkIns: nextCheckIns,
    alerts: nextAlerts,
  };

  return cachedSnapshot;
}

export function useStore() {
  const { user } = useAuth();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    void getActiveStore().refresh?.();
  }, [user?.id]);

  const activeStore = getActiveStore();
  const isCoach = user?.role === "coach";
  const coachScopedStudents = isCoach ? snapshot.students.filter((student) => student.coachId === user.id || student.coachId === user.teacherId) : snapshot.students;
  const coachStudentIds = new Set(coachScopedStudents.map((student) => student.id));
  const coachScopedCheckIns = isCoach ? snapshot.checkIns.filter((checkIn) => coachStudentIds.has(checkIn.studentId)) : snapshot.checkIns;
  const coachScopedAlerts = isCoach ? snapshot.alerts.filter((alert) => coachStudentIds.has(alert.studentId)) : snapshot.alerts;

  return {
    ...snapshot,
    students: coachScopedStudents,
    checkIns: coachScopedCheckIns,
    alerts: coachScopedAlerts,
    refresh: activeStore.refresh?.bind(activeStore),
    getStudent: activeStore.getStudent.bind(activeStore),
    getStudentByUserId: activeStore.getStudentByUserId.bind(activeStore),
    getStudentCheckIns: activeStore.getStudentCheckIns.bind(activeStore),
    addStudent: activeStore.addStudent.bind(activeStore),
    updateStudent: activeStore.updateStudent.bind(activeStore),
    provisionStudentAccess: activeStore.provisionStudentAccess.bind(activeStore),
    completeStudentFirstAccess: activeStore.completeStudentFirstAccess.bind(activeStore),
    resetStudentTemporaryAccess: activeStore.resetStudentTemporaryAccess.bind(activeStore),
    markStudentLastLogin: activeStore.markStudentLastLogin.bind(activeStore),
    submitProofOfPayment: activeStore.submitProofOfPayment.bind(activeStore),
    approveProofOfPayment: activeStore.approveProofOfPayment.bind(activeStore),
    markPaymentReceived: activeStore.markPaymentReceived.bind(activeStore),
    updatePaymentDueDate: activeStore.updatePaymentDueDate.bind(activeStore),
    registerStudentCheckIn: activeStore.registerStudentCheckIn.bind(activeStore),
    updateStudentExerciseLoad: activeStore.updateStudentExerciseLoad.bind(activeStore),
    markCoachAlertRead: activeStore.markCoachAlertRead.bind(activeStore),
    setStudentLifecycle: activeStore.setStudentLifecycle.bind(activeStore),
    deleteStudent: activeStore.deleteStudent.bind(activeStore),
    importWorkoutToStudent: activeStore.importWorkoutToStudent.bind(activeStore),
    getWorkout: activeStore.getWorkout.bind(activeStore),
    addWorkout: activeStore.addWorkout.bind(activeStore),
    updateWorkout: activeStore.updateWorkout.bind(activeStore),
    deleteWorkout: activeStore.deleteWorkout.bind(activeStore),
    duplicateWorkout: activeStore.duplicateWorkout.bind(activeStore),
  };
}
