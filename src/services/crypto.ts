/**
 * Cryptographic utilities for Kudumba Vault
 * Uses Web Crypto API for real SHA-256 hashing and AES-GCM encryption
 */

/**
 * Generate a real SHA-256 hash of a file using the Web Crypto API
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a SHA-256 hash of arbitrary text/data
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a cryptographic key for AES-GCM encryption
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt file data using AES-256-GCM
 * Returns the encrypted data with the IV prepended
 */
export async function encryptFile(file: File, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileData = await file.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileData
  );

  // Prepend IV to encrypted data for later decryption
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  return result.buffer;
}

/**
 * Decrypt file data that was encrypted with encryptFile
 */
export async function decryptFile(encryptedData: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const data = new Uint8Array(encryptedData);
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);

  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
}

/**
 * Export a CryptoKey to a hex string for storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  const keyArray = Array.from(new Uint8Array(raw));
  return keyArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Import a hex string back to a CryptoKey
 */
export async function importKey(hexKey: string): Promise<CryptoKey> {
  const keyData = new Uint8Array(hexKey.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Convert bytes32 hex string to the format ethers expects
 */
export function toBytes32(hash: string): string {
  // Ensure 0x prefix and 64 hex chars
  const clean = hash.startsWith("0x") ? hash.slice(2) : hash;
  return "0x" + clean.padStart(64, "0");
}

/**
 * Format a hash for display (truncated)
 */
export function formatHash(hash: string, chars = 8): string {
  if (!hash) return "";
  const clean = hash.startsWith("0x") ? hash : "0x" + hash;
  return `${clean.slice(0, chars + 2)}...${clean.slice(-chars)}`;
}

/**
 * Generate a file integrity fingerprint combining hash + metadata
 */
export async function generateFingerprint(file: File): Promise<{
  hash: string;
  size: number;
  name: string;
  type: string;
  lastModified: number;
}> {
  const hash = await hashFile(file);
  return {
    hash,
    size: file.size,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
  };
}
