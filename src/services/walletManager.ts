/**
 * Managed Wallet Service for Kudumba Vault
 * 
 * Provides transparent blockchain wallet management for family members
 * who don't know about MetaMask. Wallets are generated client-side,
 * private keys are encrypted with the user's password using PBKDF2 + AES-256-GCM,
 * and only the encrypted blob is stored server-side.
 * 
 * Security model:
 * - Private keys are NEVER stored or transmitted in plaintext
 * - Encryption key is derived from user's password + unique salt via PBKDF2 (100k iterations)
 * - AES-256-GCM provides authenticated encryption (tamper detection)
 * - Server only holds the encrypted blob — cannot decrypt without the user's password
 * - Wallet is decrypted client-side in memory only during the session
 */

import { ethers } from "ethers";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface EncryptedWalletData {
  /** Hex-encoded encrypted private key (IV + ciphertext) */
  encryptedKey: string;
  /** Hex-encoded PBKDF2 salt */
  salt: string;
  /** Public wallet address (safe to store in plaintext) */
  address: string;
  /** Version for future migration support */
  version: number;
}

export interface ManagedWalletInfo {
  address: string;
  privateKey: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // bytes for AES-GCM
const CURRENT_VERSION = 1;

// ─── Key Derivation ─────────────────────────────────────────────────────────────

/**
 * Derive an AES-256 encryption key from a password using PBKDF2
 * This is the core security mechanism — the password never leaves the client
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Hex Utilities ──────────────────────────────────────────────────────────────

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a brand new Ethereum wallet and encrypt the private key
 * with the user's password. Returns the encrypted data (safe to store on server)
 * and the wallet address.
 * 
 * Called when: Owner adds a new family member
 */
export async function generateManagedWallet(
  password: string
): Promise<EncryptedWalletData> {
  // 1. Generate a random Ethereum wallet
  const wallet = ethers.Wallet.createRandom();
  const privateKey = wallet.privateKey; // 0x-prefixed hex

  // 2. Generate a random salt for PBKDF2
  const salt = crypto.getRandomValues(new Uint8Array(32));

  // 3. Derive encryption key from password + salt
  const encryptionKey = await deriveKeyFromPassword(password, salt);

  // 4. Encrypt the private key with AES-256-GCM
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    encoder.encode(privateKey)
  );

  // 5. Combine IV + ciphertext into a single blob
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return {
    encryptedKey: toHex(combined),
    salt: toHex(salt),
    address: wallet.address,
    version: CURRENT_VERSION,
  };
}

/**
 * Decrypt a managed wallet's private key using the user's password.
 * All decryption happens client-side — the server never sees the password or plaintext key.
 * 
 * Called when: Member logs in
 */
export async function decryptManagedWallet(
  encryptedData: EncryptedWalletData,
  password: string
): Promise<ManagedWalletInfo> {
  // 1. Reconstruct the salt and derive the same key
  const salt = fromHex(encryptedData.salt);
  const encryptionKey = await deriveKeyFromPassword(password, salt);

  // 2. Split IV and ciphertext
  const combined = fromHex(encryptedData.encryptedKey);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // 3. Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      encryptionKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    const privateKey = decoder.decode(decrypted);

    // 4. Verify the decrypted key produces the expected address
    const wallet = new ethers.Wallet(privateKey);
    if (wallet.address.toLowerCase() !== encryptedData.address.toLowerCase()) {
      throw new Error("Wallet address mismatch — possible data corruption");
    }

    return {
      address: wallet.address,
      privateKey,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "OperationError") {
      throw new Error("Invalid password — could not decrypt wallet");
    }
    throw err;
  }
}

/**
 * Re-encrypt a wallet's private key with a new password.
 * Used when a member changes their password.
 * 
 * Called when: Member updates their password
 */
export async function reEncryptWallet(
  encryptedData: EncryptedWalletData,
  oldPassword: string,
  newPassword: string
): Promise<EncryptedWalletData> {
  // Decrypt with old password
  const { privateKey, address } = await decryptManagedWallet(encryptedData, oldPassword);

  // Re-encrypt with new password (fresh salt)
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const encryptionKey = await deriveKeyFromPassword(newPassword, salt);

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    encoder.encode(privateKey)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return {
    encryptedKey: toHex(combined),
    salt: toHex(salt),
    address,
    version: CURRENT_VERSION,
  };
}

/**
 * Create an ethers.js Wallet instance from a private key, connected to a JSON-RPC provider.
 * This wallet can sign transactions just like MetaMask but without any browser extension.
 * 
 * Called when: Member needs to perform blockchain operations
 */
export function createSignerFromKey(
  privateKey: string,
  rpcUrl: string = import.meta.env.VITE_SEPOLIA_RPC_URL || "https://rpc.sepolia.org"
): ethers.Wallet {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Get a display-safe version of the wallet info (no private key)
 */
export function getWalletDisplayInfo(address: string): {
  shortAddress: string;
  fullAddress: string;
} {
  return {
    shortAddress: `${address.slice(0, 6)}...${address.slice(-4)}`,
    fullAddress: address,
  };
}
