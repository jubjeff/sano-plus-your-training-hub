const PAYMENT_PROOF_DB = "sano-plus-payment-proofs";
const PAYMENT_PROOF_STORE = "payment-proofs";
const MAX_PAYMENT_PROOF_SIZE = 8 * 1024 * 1024;
const ACCEPTED_PAYMENT_PROOF_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(PAYMENT_PROOF_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PAYMENT_PROOF_STORE)) {
        db.createObjectStore(PAYMENT_PROOF_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createStorageKey() {
  return `proof-${Math.random().toString(36).slice(2, 10)}`;
}

export function validatePaymentProofFile(file: File) {
  if (!ACCEPTED_PAYMENT_PROOF_TYPES.includes(file.type)) {
    return "Envie um PDF, JPG, PNG ou WebP.";
  }

  if (file.size > MAX_PAYMENT_PROOF_SIZE) {
    return "O comprovante deve ter no maximo 8 MB.";
  }

  return null;
}

export async function persistPaymentProofFile(file: File, existingKey?: string | null) {
  const storageKey = existingKey || createStorageKey();
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PAYMENT_PROOF_STORE, "readwrite");
    const store = transaction.objectStore(PAYMENT_PROOF_STORE);
    const request = store.put(file, storageKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  return storageKey;
}

export async function loadPaymentProofFile(storageKey?: string | null) {
  if (!storageKey) return null;
  const db = await openDb();

  return new Promise<File | Blob | null>((resolve, reject) => {
    const transaction = db.transaction(PAYMENT_PROOF_STORE, "readonly");
    const store = transaction.objectStore(PAYMENT_PROOF_STORE);
    const request = store.get(storageKey);
    request.onsuccess = () => resolve((request.result as File | Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function removePaymentProofFile(storageKey?: string | null) {
  if (!storageKey) return;
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PAYMENT_PROOF_STORE, "readwrite");
    const store = transaction.objectStore(PAYMENT_PROOF_STORE);
    const request = store.delete(storageKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
