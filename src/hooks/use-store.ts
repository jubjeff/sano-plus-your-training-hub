import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import { store as localStore } from "@/lib/store";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { supabaseAppStore } from "@/lib/supabase/app-store";
import type { Student, Workout, StudentCheckIn, CoachAlert } from "@/types";

interface StoreSnapshot {
  students: Student[];
  workouts: Workout[];
  checkIns: StudentCheckIn[];
  alerts: CoachAlert[];
}

function getActiveStore() {
  return hasSupabaseConfig() ? supabaseAppStore : localStore;
}

function subscribe(cb: () => void) {
  return getActiveStore().subscribe(cb);
}

function getSnapshot(): StoreSnapshot {
  const activeStore = getActiveStore();
  return {
    students: activeStore.getStudents(),
    workouts: activeStore.getWorkouts(),
    checkIns: activeStore.getCheckIns(),
    alerts: activeStore.getAlerts(),
  };
}

export function useStore() {
  const { user } = useAuth();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    void supabaseAppStore.ensureUser(user).catch(() => undefined);
  }, [user]);

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
    getStudent: activeStore.getStudent.bind(activeStore),
    getStudentByUserId: activeStore.getStudentByUserId.bind(activeStore),
    getStudentCheckIns: activeStore.getStudentCheckIns.bind(activeStore),
    addStudent: activeStore.addStudent.bind(activeStore),
    updateStudent: activeStore.updateStudent.bind(activeStore),
    provisionStudentAccess: (activeStore as any).provisionStudentAccess?.bind(activeStore),
    completeStudentFirstAccess: (activeStore as any).completeStudentFirstAccess?.bind(activeStore),
    resetStudentTemporaryAccess: (activeStore as any).resetStudentTemporaryAccess?.bind(activeStore),
    markStudentLastLogin: (activeStore as any).markStudentLastLogin?.bind(activeStore),
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
