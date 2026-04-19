export const MAX_EXERCISE_VIDEO_SIZE_MB = 12;
export const MAX_EXERCISE_VIDEO_DURATION_SECONDS = 6;
const MAX_EXERCISE_VIDEO_SIZE_BYTES = MAX_EXERCISE_VIDEO_SIZE_MB * 1024 * 1024;

const EXERCISE_MEDIA_DB = "sano-plus-media";
const EXERCISE_MEDIA_STORE = "exercise-videos";

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openExerciseMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB indisponível."));
      return;
    }

    const request = window.indexedDB.open(EXERCISE_MEDIA_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EXERCISE_MEDIA_STORE)) {
        db.createObjectStore(EXERCISE_MEDIA_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o IndexedDB."));
  });
}

function generateVideoStorageKey() {
  return `exercise-video-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
}

function readVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a duração do vídeo."));
    };
    video.src = url;
  });
}

export async function validateExerciseVideoFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".mp4") && file.type !== "video/mp4") {
    return "Envie um arquivo MP4 válido.";
  }

  if (file.size > MAX_EXERCISE_VIDEO_SIZE_BYTES) {
    return `O vídeo deve ter no máximo ${MAX_EXERCISE_VIDEO_SIZE_MB} MB.`;
  }

  try {
    const duration = await readVideoDuration(file);
    if (duration > MAX_EXERCISE_VIDEO_DURATION_SECONDS) {
      return `O vídeo deve ter no máximo ${MAX_EXERCISE_VIDEO_DURATION_SECONDS} segundos.`;
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Não foi possível validar o vídeo.";
  }

  return null;
}

export function createVideoPreviewUrl(file: File) {
  return URL.createObjectURL(file);
}

export async function persistExerciseVideoFile(file: File, existingKey?: string | null) {
  const db = await openExerciseMediaDb();
  const storageKey = existingKey || generateVideoStorageKey();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(EXERCISE_MEDIA_STORE, "readwrite");
    const store = transaction.objectStore(EXERCISE_MEDIA_STORE);
    const request = store.put(file, storageKey);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Falha ao salvar o vídeo."));
  });

  return storageKey;
}

export async function loadPersistedExerciseVideo(storageKey?: string | null) {
  if (!storageKey) return null;
  const db = await openExerciseMediaDb();

  return new Promise<string | null>((resolve, reject) => {
    const transaction = db.transaction(EXERCISE_MEDIA_STORE, "readonly");
    const store = transaction.objectStore(EXERCISE_MEDIA_STORE);
    const request = store.get(storageKey);

    request.onsuccess = () => {
      const file = request.result as Blob | undefined;
      if (!file) {
        resolve(null);
        return;
      }
      resolve(URL.createObjectURL(file));
    };

    request.onerror = () => reject(request.error ?? new Error("Falha ao carregar o vídeo."));
  });
}

export async function removePersistedExerciseVideo(storageKey?: string | null) {
  if (!storageKey) return;
  const db = await openExerciseMediaDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(EXERCISE_MEDIA_STORE, "readwrite");
    const store = transaction.objectStore(EXERCISE_MEDIA_STORE);
    const request = store.delete(storageKey);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Falha ao remover o vídeo."));
  });
}
