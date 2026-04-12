const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([\w-]{11})/i,
  /(?:youtu\.be\/)([\w-]{11})/i,
  /(?:youtube\.com\/embed\/)([\w-]{11})/i,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/i,
];

const EXERCISE_MEDIA_DB = "sano-plus-media";
const EXERCISE_MEDIA_STORE = "exercise-videos";

export const MAX_EXERCISE_VIDEO_SIZE_MB = 50;
const MAX_EXERCISE_VIDEO_SIZE_BYTES = MAX_EXERCISE_VIDEO_SIZE_MB * 1024 * 1024;

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openExerciseMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB indisponivel."));
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

export function validateExerciseVideoFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".mp4") && file.type !== "video/mp4") {
    return "Envie um arquivo MP4 valido.";
  }

  if (file.size > MAX_EXERCISE_VIDEO_SIZE_BYTES) {
    return `O video deve ter no maximo ${MAX_EXERCISE_VIDEO_SIZE_MB} MB.`;
  }

  return null;
}

export function getYoutubeVideoId(url: string) {
  const normalized = url.trim();
  if (!normalized) return null;

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function normalizeYoutubeUrl(url: string) {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYoutubeEmbedUrl(url?: string | null) {
  if (!url) return null;
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
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
    request.onerror = () => reject(request.error ?? new Error("Falha ao salvar o video."));
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

    request.onerror = () => reject(request.error ?? new Error("Falha ao carregar o video."));
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
    request.onerror = () => reject(request.error ?? new Error("Falha ao remover o video."));
  });
}
