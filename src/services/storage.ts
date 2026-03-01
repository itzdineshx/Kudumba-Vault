/**
 * IndexedDB-based file storage for Kudumba Vault
 * Stores encrypted file blobs locally in the browser
 */

const DB_NAME = "kudumba_vault_db";
const DB_VERSION = 1;
const FILE_STORE = "files";

interface StoredFile {
  id: string; // document ID
  data: ArrayBuffer; // encrypted file data
  originalName: string;
  mimeType: string;
  size: number;
  encryptedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store an encrypted file blob in IndexedDB
 */
export async function storeFile(
  docId: string,
  encryptedData: ArrayBuffer,
  originalName: string,
  mimeType: string,
  size: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readwrite");
    const store = tx.objectStore(FILE_STORE);
    const record: StoredFile = {
      id: docId,
      data: encryptedData,
      originalName,
      mimeType,
      size,
      encryptedAt: new Date().toISOString(),
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Retrieve an encrypted file from IndexedDB
 */
export async function retrieveFile(docId: string): Promise<StoredFile | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readonly");
    const store = tx.objectStore(FILE_STORE);
    const req = store.get(docId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Delete a file from IndexedDB
 */
export async function deleteFile(docId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readwrite");
    const store = tx.objectStore(FILE_STORE);
    const req = store.delete(docId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Clear all files from IndexedDB
 */
export async function clearAllFiles(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readwrite");
    const store = tx.objectStore(FILE_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Check if a file exists in IndexedDB
 */
export async function hasFile(docId: string): Promise<boolean> {
  const stored = await retrieveFile(docId);
  return stored !== null;
}

/**
 * Get total storage usage (approximate)
 */
export async function getStorageUsage(): Promise<{ count: number; totalBytes: number }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readonly");
    const store = tx.objectStore(FILE_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const files = req.result as StoredFile[];
      resolve({
        count: files.length,
        totalBytes: files.reduce((sum, f) => sum + f.size, 0),
      });
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
