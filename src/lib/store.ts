import { Student, Workout } from "@/types";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
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

const initialStudents: Student[] = [
  {
    id: "s1",
    name: "Lucas Oliveira",
    phone: "(11) 98765-4321",
    email: "lucas@email.com",
    objective: "Hipertrofia",
    notes: "Lesão no ombro esquerdo. Evitar supino reto pesado nas próximas semanas.",
    active: true,
    startDate: daysAgo(90),
    workoutUpdatedAt: daysAgo(25),
    nextWorkoutChange: daysFromNow(5),
    workout: [
      {
        id: "b1",
        name: "Treino A - Peito e Tríceps",
        exercises: [
          { id: "e1", name: "Supino inclinado com halteres", sets: 4, reps: "10-12", load: "24kg", rest: "90s", notes: "" },
          { id: "e2", name: "Crucifixo na máquina", sets: 3, reps: "12-15", load: "40kg", rest: "60s", notes: "" },
          { id: "e3", name: "Tríceps pulley com corda", sets: 3, reps: "12", load: "25kg", rest: "60s", notes: "" },
          { id: "e4", name: "Tríceps francês", sets: 3, reps: "10", load: "12kg", rest: "60s", notes: "" },
        ],
      },
      {
        id: "b2",
        name: "Treino B - Costas e Bíceps",
        exercises: [
          { id: "e5", name: "Puxada frontal", sets: 4, reps: "10-12", load: "55kg", rest: "90s", notes: "" },
          { id: "e6", name: "Remada curvada", sets: 4, reps: "10", load: "40kg", rest: "90s", notes: "" },
          { id: "e7", name: "Rosca direta com barra", sets: 3, reps: "12", load: "20kg", rest: "60s", notes: "" },
        ],
      },
    ],
  },
  {
    id: "s2",
    name: "Ana Carolina Santos",
    phone: "(11) 91234-5678",
    email: "ana@email.com",
    objective: "Emagrecimento",
    notes: "Priorizar progressão gradual e aderência semanal.",
    active: true,
    startDate: daysAgo(30),
    workoutUpdatedAt: daysAgo(28),
    nextWorkoutChange: daysFromNow(2),
    workout: [
      {
        id: "b3",
        name: "Treino A - Full Body",
        exercises: [
          { id: "e8", name: "Agachamento livre", sets: 4, reps: "12", load: "30kg", rest: "60s", notes: "" },
          { id: "e9", name: "Supino reto máquina", sets: 3, reps: "12", load: "20kg", rest: "60s", notes: "" },
          { id: "e10", name: "Prancha", sets: 3, reps: "45s", load: "-", rest: "30s", notes: "" },
        ],
      },
    ],
  },
  {
    id: "s3",
    name: "Pedro Henrique Costa",
    phone: "(21) 99876-5432",
    email: "pedro@email.com",
    objective: "Ganho de força",
    notes: "Treina 5x por semana e responde bem a progressões lineares.",
    active: true,
    startDate: daysAgo(180),
    workoutUpdatedAt: daysAgo(10),
    nextWorkoutChange: daysFromNow(20),
    workout: [],
  },
  {
    id: "s4",
    name: "Mariana Ferreira",
    phone: "(31) 98765-1234",
    email: "mariana@email.com",
    objective: "Condicionamento físico",
    notes: "Retomada após 6 meses parada. Monitorar volume na adaptação.",
    active: true,
    startDate: daysAgo(14),
    workoutUpdatedAt: daysAgo(14),
    nextWorkoutChange: daysFromNow(16),
    workout: [],
  },
  {
    id: "s5",
    name: "Rafael Souza",
    phone: "(11) 97654-3210",
    email: "rafael@email.com",
    objective: "Hipertrofia",
    notes: "",
    active: false,
    startDate: daysAgo(365),
    workout: [],
  },
  {
    id: "s6",
    name: "Juliana Lima",
    phone: "(11) 96543-2109",
    email: "juliana@email.com",
    objective: "Emagrecimento",
    notes: "Pausou por motivos pessoais.",
    active: false,
    startDate: daysAgo(200),
    workout: [],
  },
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
          { id: "we1", name: "Supino reto com barra", sets: 4, reps: "8-10", load: "-", rest: "90s", notes: "" },
          { id: "we2", name: "Puxada frontal", sets: 4, reps: "10-12", load: "-", rest: "90s", notes: "" },
          { id: "we3", name: "Desenvolvimento com halteres", sets: 3, reps: "10", load: "-", rest: "60s", notes: "" },
          { id: "we4", name: "Rosca direta", sets: 3, reps: "12", load: "-", rest: "60s", notes: "" },
          { id: "we5", name: "Tríceps pulley", sets: 3, reps: "12", load: "-", rest: "60s", notes: "" },
        ],
      },
      {
        id: "wb2",
        name: "Treino B - Inferior",
        exercises: [
          { id: "we6", name: "Agachamento livre", sets: 4, reps: "8-10", load: "-", rest: "120s", notes: "" },
          { id: "we7", name: "Leg press 45°", sets: 4, reps: "10-12", load: "-", rest: "90s", notes: "" },
          { id: "we8", name: "Cadeira extensora", sets: 3, reps: "12-15", load: "-", rest: "60s", notes: "" },
          { id: "we9", name: "Mesa flexora", sets: 3, reps: "12", load: "-", rest: "60s", notes: "" },
          { id: "we10", name: "Panturrilha em pé", sets: 4, reps: "15", load: "-", rest: "45s", notes: "" },
        ],
      },
    ],
  },
  {
    id: "w2",
    name: "Treino Emagrecimento Full Body",
    objective: "Emagrecimento",
    notes: "Circuito com foco em gasto calórico e eficiência operacional.",
    createdAt: daysAgo(45),
    blocks: [
      {
        id: "wb3",
        name: "Circuito único",
        exercises: [
          { id: "we11", name: "Burpee", sets: 3, reps: "15", load: "-", rest: "30s", notes: "" },
          { id: "we12", name: "Agachamento com salto", sets: 3, reps: "15", load: "-", rest: "30s", notes: "" },
          { id: "we13", name: "Flexão de braço", sets: 3, reps: "12", load: "-", rest: "30s", notes: "" },
          { id: "we14", name: "Prancha", sets: 3, reps: "45s", load: "-", rest: "30s", notes: "" },
          { id: "we15", name: "Mountain climber", sets: 3, reps: "20", load: "-", rest: "30s", notes: "" },
        ],
      },
    ],
  },
];

type Listener = () => void;

class Store {
  private students: Student[] = [...initialStudents];
  private workouts: Workout[] = [...initialWorkouts];
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  getStudents() {
    return this.students;
  }

  getStudent(id: string) {
    return this.students.find((student) => student.id === id);
  }

  addStudent(data: Omit<Student, "id" | "workout">) {
    const student: Student = { ...data, id: generateId(), workout: [] };
    this.students = [student, ...this.students];
    this.notify();
    return student;
  }

  updateStudent(id: string, data: Partial<Student>) {
    this.students = this.students.map((student) => (student.id === id ? { ...student, ...data } : student));
    this.notify();
  }

  deleteStudent(id: string) {
    this.students = this.students.filter((student) => student.id !== id);
    this.notify();
  }

  importWorkoutToStudent(studentId: string, workoutId: string) {
    const workout = this.workouts.find((item) => item.id === workoutId);
    if (!workout) return;

    const newBlocks = workout.blocks.map((block) => ({
      ...block,
      id: generateId(),
      exercises: block.exercises.map((exercise) => ({ ...exercise, id: generateId() })),
    }));

    this.updateStudent(studentId, {
      workout: newBlocks,
      workoutUpdatedAt: new Date().toISOString().split("T")[0],
    });
  }

  getWorkouts() {
    return this.workouts;
  }

  getWorkout(id: string) {
    return this.workouts.find((workout) => workout.id === id);
  }

  addWorkout(data: Omit<Workout, "id" | "createdAt">) {
    const workout: Workout = { ...data, id: generateId(), createdAt: new Date().toISOString().split("T")[0] };
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
      name: `${workout.name} (cópia)`,
      createdAt: new Date().toISOString().split("T")[0],
      blocks: workout.blocks.map((block) => ({
        ...block,
        id: generateId(),
        exercises: block.exercises.map((exercise) => ({ ...exercise, id: generateId() })),
      })),
    };

    this.workouts = [duplicate, ...this.workouts];
    this.notify();
    return duplicate;
  }
}

export const store = new Store();
