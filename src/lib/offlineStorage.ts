/**
 * Offline Storage Module
 * Handles IndexedDB and localStorage for offline data persistence
 */

import type { MonthlyData } from "@/hooks/useDatabase";

const DB_NAME = "plan_compass_offline";
const DB_VERSION = 1;
const MONTHLY_DATA_STORE = "monthly_data";
const SYNC_QUEUE_STORE = "sync_queue";
const METADATA_STORE = "metadata";

export interface SyncQueueItem {
  id: string;
  type: "monthly_data" | "annual_plan";
  action: "create" | "update" | "delete";
  data: unknown;
  timestamp: number;
  retries: number;
  lastError?: string;
}

export interface SyncMetadata {
  key: string;
  value: unknown;
  updatedAt: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export async function initializeDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(MONTHLY_DATA_STORE)) {
        db.createObjectStore(MONTHLY_DATA_STORE, {
          keyPath: ["year", "month", "indicator_code"],
        });
      }

      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };
  });
}

/**
 * Save monthly data entry to IndexedDB
 */
export async function saveMonthlyDataOffline(data: MonthlyData): Promise<void> {
  const db = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MONTHLY_DATA_STORE], "readwrite");
    const store = transaction.objectStore(MONTHLY_DATA_STORE);
    const request = store.put(data);

    request.onerror = () => reject(new Error("Failed to save monthly data"));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get all monthly data from IndexedDB for a specific year
 */
export async function getMonthlyDataOffline(year: number): Promise<MonthlyData[]> {
  const db = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MONTHLY_DATA_STORE], "readonly");
    const store = transaction.objectStore(MONTHLY_DATA_STORE);
    const request = store.getAll();

    request.onerror = () => reject(new Error("Failed to retrieve monthly data"));
    request.onsuccess = () => {
      const allData = request.result as MonthlyData[];
      const yearData = allData.filter((d) => d.year === year);
      resolve(yearData);
    };
  });
}

/**
 * Clear all offline data
 */
export async function clearOfflineData(): Promise<void> {
  const db = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MONTHLY_DATA_STORE, SYNC_QUEUE_STORE], "readwrite");

    transaction.onerror = () => reject(new Error("Failed to clear offline data"));
    transaction.oncomplete = () => resolve();

    transaction.objectStore(MONTHLY_DATA_STORE).clear();
    transaction.objectStore(SYNC_QUEUE_STORE).clear();
  });
}

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, "id">): Promise<string> {
  const db = await initializeDB();
  const id = `${item.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE], "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.add({ ...item, id, retries: 0 });

    request.onerror = () => reject(new Error("Failed to add to sync queue"));
    request.onsuccess = () => resolve(id);
  });
}

/**
 * Get all items from sync queue
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE], "readonly");
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(new Error("Failed to retrieve sync queue"));
    request.onsuccess = () => resolve(request.result as SyncQueueItem[]);
  });
}

/**
 * Remove item from sync queue (after successful sync)
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE], "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(new Error("Failed to remove from sync queue"));
    request.onsuccess = () => resolve();
  });
}

/**
 * Update sync queue item (e.g., increment retries)
 */
export async function updateSyncQueueItem(
  id: string,
  updates: Partial<SyncQueueItem>
): Promise<void> {
  const db = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE], "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(new Error("Failed to update sync queue item"));
    getRequest.onsuccess = () => {
      const item = getRequest.result as SyncQueueItem;
      const updated = { ...item, ...updates };
      const putRequest = store.put(updated);

      putRequest.onerror = () => reject(new Error("Failed to update sync queue item"));
      putRequest.onsuccess = () => resolve();
    };
  });
}

/**
 * Save sync metadata (e.g., last sync timestamp)
 */
export async function saveSyncMetadata(key: string, value: unknown): Promise<void> {
  const db = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], "readwrite");
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.put({ key, value, updatedAt: Date.now() });

    request.onerror = () => reject(new Error("Failed to save metadata"));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get sync metadata
 */
export async function getSyncMetadata(key: string): Promise<unknown | undefined> {
  const db = await initializeDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], "readonly");
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.get(key);

    request.onerror = () => reject(new Error("Failed to retrieve metadata"));
    request.onsuccess = () => {
      const item = request.result as SyncMetadata | undefined;
      resolve(item?.value);
    };
  });
}

/**
 * Check if offline sync is needed
 */
export function isOfflineSyncNeeded(): boolean {
  return !navigator.onLine;
}

/**
 * Get offline status
 */
export function isOfflineMode(): boolean {
  return !navigator.onLine;
}

/**
 * Initialize offline listeners
 */
export function setupOnlineAvailabilityListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

/**
 * Save data to localStorage for quick access
 */
export function saveToLocalStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
  }
}

/**
 * Get data from localStorage
 */
export function getFromLocalStorage<T>(key: string, defaultValue?: T): T | undefined {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Failed to get from localStorage: ${key}`, error);
    return defaultValue;
  }
}

/**
 * Remove data from localStorage
 */
export function removeFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove from localStorage: ${key}`, error);
  }
}
