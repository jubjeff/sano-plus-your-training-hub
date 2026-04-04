import { useSyncExternalStore } from "react";
import { store } from "@/lib/store";
import { Student, Workout } from "@/types";

interface StoreSnapshot {
  students: Student[];
  workouts: Workout[];
}

let cachedSnapshot: StoreSnapshot = {
  students: store.getStudents(),
  workouts: store.getWorkouts(),
};

store.subscribe(() => {
  cachedSnapshot = {
    students: store.getStudents(),
    workouts: store.getWorkouts(),
  };
});

function subscribe(cb: () => void) {
  return store.subscribe(cb);
}

function getSnapshot() {
  return cachedSnapshot;
}

export function useStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  return {
    ...snapshot,
    getStudent: store.getStudent.bind(store),
    addStudent: store.addStudent.bind(store),
    updateStudent: store.updateStudent.bind(store),
    deleteStudent: store.deleteStudent.bind(store),
    importWorkoutToStudent: store.importWorkoutToStudent.bind(store),
    getWorkout: store.getWorkout.bind(store),
    addWorkout: store.addWorkout.bind(store),
    updateWorkout: store.updateWorkout.bind(store),
    deleteWorkout: store.deleteWorkout.bind(store),
    duplicateWorkout: store.duplicateWorkout.bind(store),
  };
}
