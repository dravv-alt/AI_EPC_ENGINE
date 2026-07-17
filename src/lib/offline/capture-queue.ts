export type CaptureState = "pending_sync" | "processing" | "needs_review" | "accepted" | "rejected" | "failed";
export type CaptureInput = { id: string; projectId: string; systemId: string; assetId?: string; evidenceType: string; notes: string; capturedAt: string; artifact?: File };
export type QueuedCapture = Omit<CaptureInput, "artifact"> & { state: CaptureState; error?: string; artifact?: File; updatedAt: string };

type StoredCapture = Omit<QueuedCapture, "notes" | "artifact"> & {
  encrypted: boolean;
  notesData: ArrayBuffer | string;
  notesIv?: ArrayBuffer;
  artifactData?: ArrayBuffer;
  artifactIv?: ArrayBuffer;
  artifactName?: string;
  artifactType?: string;
};

const databaseName = "pramana-field-capture-v1";
const maxRecords = 50;
const maxBytes = 100 * 1024 * 1024;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("captures")) db.createObjectStore("captures", { keyPath: "id" });
      if (!db.objectStoreNames.contains("keys")) db.createObjectStore("keys");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function encryptionKey(db: IDBDatabase) {
  const current = await transactionRequest(db.transaction("keys").objectStore("keys").get("capture-key")) as CryptoKey | undefined;
  if (current) return current;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await transactionRequest(db.transaction("keys", "readwrite").objectStore("keys").put(key, "capture-key"));
  return key;
}

async function encrypt(key: CryptoKey, bytes: ArrayBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { data: await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer }, key, bytes), iv: iv.buffer };
}

async function decrypt(key: CryptoKey, data: ArrayBuffer, iv: ArrayBuffer) {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
}

async function allStored(db: IDBDatabase) {
  return transactionRequest(db.transaction("captures").objectStore("captures").getAll()) as Promise<StoredCapture[]>;
}

async function decode(db: IDBDatabase, stored: StoredCapture): Promise<QueuedCapture> {
  if (!stored.encrypted) {
    return { ...stored, notes: String(stored.notesData), artifact: stored.artifactData ? new File([stored.artifactData], stored.artifactName ?? "artifact", { type: stored.artifactType }) : undefined };
  }
  const key = await encryptionKey(db);
  const notes = new TextDecoder().decode(await decrypt(key, stored.notesData as ArrayBuffer, stored.notesIv!));
  const artifactBytes = stored.artifactData && stored.artifactIv ? await decrypt(key, stored.artifactData, stored.artifactIv) : undefined;
  return { ...stored, notes, artifact: artifactBytes ? new File([artifactBytes], stored.artifactName ?? "artifact", { type: stored.artifactType }) : undefined };
}

export async function listCaptures() {
  const db = await openDatabase();
  const items = await Promise.all((await allStored(db)).map((item) => decode(db, item)));
  db.close();
  return items.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function queueCapture(input: CaptureInput) {
  const db = await openDatabase();
  const existing = await allStored(db);
  const usedBytes = existing.reduce((total, item) => total + (item.artifactData?.byteLength ?? 0), 0);
  if (existing.length >= maxRecords) throw new Error(`The offline queue is limited to ${maxRecords} records. Synchronize or remove completed captures first.`);
  if (usedBytes + (input.artifact?.size ?? 0) > maxBytes) throw new Error("The encrypted offline queue is limited to 100 MB. Synchronize existing artifacts first.");
  const base = { ...input, state: "pending_sync" as const, updatedAt: new Date().toISOString() };
  let stored: StoredCapture;
  try {
    const key = await encryptionKey(db);
    const notes = await encrypt(key, new TextEncoder().encode(input.notes).buffer);
    const artifact = input.artifact ? await encrypt(key, await input.artifact.arrayBuffer()) : undefined;
    stored = { ...base, encrypted: true, notesData: notes.data, notesIv: notes.iv, artifactData: artifact?.data, artifactIv: artifact?.iv, artifactName: input.artifact?.name, artifactType: input.artifact?.type };
  } catch {
    stored = { ...base, encrypted: false, notesData: input.notes, artifactData: input.artifact ? await input.artifact.arrayBuffer() : undefined, artifactName: input.artifact?.name, artifactType: input.artifact?.type };
  }
  await transactionRequest(db.transaction("captures", "readwrite").objectStore("captures").put(stored));
  db.close(); window.dispatchEvent(new Event("pramana-queue-change"));
}

export async function updateCaptureState(id: string, state: CaptureState, error?: string) {
  const db = await openDatabase();
  const store = db.transaction("captures", "readwrite").objectStore("captures");
  const item = await transactionRequest(store.get(id)) as StoredCapture | undefined;
  if (item) await transactionRequest(store.put({ ...item, state, error, updatedAt: new Date().toISOString() }));
  db.close(); window.dispatchEvent(new Event("pramana-queue-change"));
}

export async function removeCapture(id: string) {
  const db = await openDatabase();
  await transactionRequest(db.transaction("captures", "readwrite").objectStore("captures").delete(id));
  db.close(); window.dispatchEvent(new Event("pramana-queue-change"));
}
