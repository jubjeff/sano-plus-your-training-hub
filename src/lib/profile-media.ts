const PROFILE_MEDIA_DB = "sano-plus-profile-media";
const PROFILE_MEDIA_STORE = "avatars";
export const MAX_PROFILE_IMAGE_SIZE_MB = 5;
const MAX_PROFILE_IMAGE_SIZE_BYTES = MAX_PROFILE_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openProfileMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB indisponivel."));
      return;
    }

    const request = window.indexedDB.open(PROFILE_MEDIA_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROFILE_MEDIA_STORE)) {
        db.createObjectStore(PROFILE_MEDIA_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o armazenamento de avatar."));
  });
}

function createProfileStorageKey() {
  return `profile-avatar-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

export function validateProfileImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Envie uma imagem JPG, PNG ou WEBP.";
  }

  if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
    return `A foto deve ter no maximo ${MAX_PROFILE_IMAGE_SIZE_MB} MB.`;
  }

  return null;
}

export function createProfilePreviewUrl(file: File) {
  return URL.createObjectURL(file);
}

export async function persistProfileImageFile(file: File, existingKey?: string | null) {
  const db = await openProfileMediaDb();
  const storageKey = existingKey || createProfileStorageKey();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PROFILE_MEDIA_STORE, "readwrite");
    const store = transaction.objectStore(PROFILE_MEDIA_STORE);
    const request = store.put(file, storageKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Falha ao salvar a foto de perfil."));
  });

  return storageKey;
}

export async function loadPersistedProfileImage(storageKey?: string | null) {
  if (!storageKey) return null;
  const db = await openProfileMediaDb();

  return new Promise<string | null>((resolve, reject) => {
    const transaction = db.transaction(PROFILE_MEDIA_STORE, "readonly");
    const store = transaction.objectStore(PROFILE_MEDIA_STORE);
    const request = store.get(storageKey);

    request.onsuccess = () => {
      const file = request.result as Blob | undefined;
      if (!file) {
        resolve(null);
        return;
      }
      resolve(URL.createObjectURL(file));
    };

    request.onerror = () => reject(request.error ?? new Error("Falha ao carregar a foto de perfil."));
  });
}

export async function removePersistedProfileImage(storageKey?: string | null) {
  if (!storageKey) return;
  const db = await openProfileMediaDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PROFILE_MEDIA_STORE, "readwrite");
    const store = transaction.objectStore(PROFILE_MEDIA_STORE);
    const request = store.delete(storageKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Falha ao remover a foto de perfil."));
  });
}
