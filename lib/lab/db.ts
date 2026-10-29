// The Compass Lab IndexedDB database: cached price history ("bars") and saved
// strategies ("strategies"). Settings → Delete Lab data removes all of it.

const DB_NAME = "compass-lab";
const VERSION = 2;
export type LabStoreName = "bars" | "strategies";

let opening: Promise<IDBDatabase> | null = null;

export function openLabDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // Version 1 stored per-range bar objects; version 2 stores one compact full history per ticker.
      if (event.oldVersion < 2 && db.objectStoreNames.contains("bars")) db.deleteObjectStore("bars");
      if (!db.objectStoreNames.contains("bars")) db.createObjectStore("bars", { keyPath: "ticker" });
      if (!db.objectStoreNames.contains("strategies")) db.createObjectStore("strategies", { keyPath: "id" });
    };
    req.onsuccess = () => {
      // Let a delete or upgrade in another tab proceed instead of blocking on this one.
      req.result.onversionchange = () => {
        req.result.close();
        opening = null;
      };
      resolve(req.result);
    };
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

export function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(store: LabStoreName, key: string): Promise<T | undefined> {
  return idbRequest((await openLabDb()).transaction(store).objectStore(store).get(key));
}

export async function idbGetAll<T>(store: LabStoreName): Promise<T[]> {
  return idbRequest((await openLabDb()).transaction(store).objectStore(store).getAll());
}

async function write(store: LabStoreName, run: (s: IDBObjectStore) => void): Promise<void> {
  const tx = (await openLabDb()).transaction(store, "readwrite");
  run(tx.objectStore(store));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const idbPut = (store: LabStoreName, value: unknown) => write(store, (s) => s.put(value));
export const idbDelete = (store: LabStoreName, key: string) => write(store, (s) => s.delete(key));

/** Delete the whole Lab database. Resolves even if another tab holds it open (deletion then waits for that tab). */
export function deleteLabDb(): Promise<void> {
  opening = null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
