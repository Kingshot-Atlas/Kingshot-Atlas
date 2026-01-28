const DB_NAME = 'kingshot-atlas-cache';
const DB_VERSION = 1;
const STORE_NAME = 'kingdoms';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => resolve(null);
      
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;
        if (isExpired) {
          deleteFromCache(key).catch(() => {});
          resolve(null);
          return;
        }

        resolve(entry.data);
      };
    });
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
      };

      const request = store.put(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // Silently fail - cache is optional
  }
}

export async function deleteFromCache(key: string): Promise<void> {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onerror = () => resolve();
      request.onsuccess = () => resolve();
    });
  } catch {
    // Silently fail
  }
}

export async function clearCache(): Promise<void> {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onerror = () => resolve();
      request.onsuccess = () => resolve();
    });
  } catch {
    // Silently fail
  }
}

export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetchFn();
  await setCache(key, data);
  return data;
}

export default {
  get: getCached,
  set: setCache,
  delete: deleteFromCache,
  clear: clearCache,
  getOrFetch: getCachedOrFetch,
};
