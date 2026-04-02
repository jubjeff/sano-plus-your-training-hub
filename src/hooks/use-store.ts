import { useSyncExternalStore, useCallback } from "react";
import { store } from "@/lib/store";

export function useStore() {
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), []);
  const getSnapshot = useCallback(() => ({
    students: store.getStudents(),
    workouts: store.getWorkouts(),
  }), []);

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
