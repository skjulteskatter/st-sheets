/**
 * Minimal IndexedDB key-value store for cached API responses. Every call
 * resolves even when IndexedDB is unavailable (private mode etc.): reads miss
 * and writes are dropped, so the app works online without it.
 */

const DB_NAME = "st-sheets-offline";
const STORE = "responses";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
    dbPromise ??= new Promise((resolve) => {
        try {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(STORE);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
    return dbPromise;
}

async function run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
    const db = await open();
    if (!db) return undefined;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, mode);
            const request = action(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(request?.result);
            tx.onerror = tx.onabort = () => resolve(undefined);
        } catch {
            resolve(undefined);
        }
    });
}

export async function get<T>(key: string): Promise<T | undefined> {
    return (await run("readonly", (s) => s.get(key))) as T | undefined;
}

export async function getMany<T>(keys: string[]): Promise<(T | undefined)[]> {
    return Promise.all(keys.map((k) => get<T>(k)));
}

export async function setMany(entries: [string, unknown][]): Promise<void> {
    if (!entries.length) return;
    await run("readwrite", (s) => {
        for (const [key, value] of entries) {
            s.put(value, key);
        }
    });
}

export async function clear(): Promise<void> {
    await run("readwrite", (s) => s.clear());
}
