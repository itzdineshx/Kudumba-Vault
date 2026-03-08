/**
 * Verification Service for Kudumba Vault
 * 
 * Provides PIN and biometric (WebAuthn) verification for all family members
 * before they can view or download documents.
 * 
 * Security model:
 * - PIN is shared family-wide: set once, used by all members
 * - Biometrics are synced: each member registers their own device, all are accepted family-wide
 * - PIN is hashed client-side (SHA-256) before sending to server
 * - WebAuthn uses device biometrics (fingerprint/face) with challenge-response
 * - Verification state is kept in-memory only (sessionStorage for session persistence)
 * - Auto-locks after configurable timeout
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

export type VerificationMethod = "pin" | "biometric" | "none";

export interface VerificationStatus {
  isVerified: boolean;
  method: VerificationMethod;
  verifiedAt: number | null;
  /** Whether the user has set up any verification method */
  hasPin: boolean;
  hasBiometric: boolean;
}

export interface WebAuthnCredential {
  credentialId: string;
  publicKey: string;
  /** User-friendly name like "iPhone Face ID" */
  deviceName: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Verification expires after 15 minutes of inactivity */
const VERIFICATION_TIMEOUT_MS = 15 * 60 * 1000;
const SESSION_KEY = "kv_verification_state";

// ─── PIN Hashing ────────────────────────────────────────────────────────────────

/**
 * Hash a PIN client-side before sending to the server.
 * Server never sees the raw PIN.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  // Add a domain separator to prevent rainbow table attacks
  const data = encoder.encode(`kudumba-vault-pin:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── WebAuthn (Biometric) Helpers ───────────────────────────────────────────────

/**
 * Check if WebAuthn (biometric authentication) is available on this device
 */
export function isBiometricAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials !== "undefined"
  );
}

/**
 * Check if platform authenticator (fingerprint/face) is specifically available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricAvailable()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Register a new biometric credential (fingerprint/face).
 * Returns the credential data to store on the server.
 */
export async function registerBiometric(
  userId: string,
  userName: string,
  challenge: string
): Promise<{ credentialId: string; publicKey: string; attestation: string }> {
  const challengeBuffer = Uint8Array.from(atob(challenge), c => c.charCodeAt(0));

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: challengeBuffer,
      rp: {
        name: "Kudumba Vault",
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256
        { alg: -257, type: "public-key" },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Use device biometric (not USB key)
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential;

  if (!credential) throw new Error("Biometric registration was cancelled");

  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    credentialId: bufferToBase64url(credential.rawId),
    publicKey: bufferToBase64url(response.getPublicKey()!),
    attestation: bufferToBase64url(response.attestationObject),
  };
}

/**
 * Verify using biometric (fingerprint/face).
 * Uses an existing credential to authenticate.
 */
export async function verifyBiometric(
  challenge: string,
  credentialIds: string[]
): Promise<{ credentialId: string; signature: string; authenticatorData: string; clientDataJSON: string }> {
  const challengeBuffer = Uint8Array.from(atob(challenge), c => c.charCodeAt(0));

  const allowCredentials = credentialIds.map(id => ({
    id: base64urlToBuffer(id),
    type: "public-key" as const,
    transports: ["internal" as const],
  }));

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challengeBuffer,
      rpId: window.location.hostname,
      allowCredentials,
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential;

  if (!assertion) throw new Error("Biometric verification was cancelled");

  const response = assertion.response as AuthenticatorAssertionResponse;

  return {
    credentialId: bufferToBase64url(assertion.rawId),
    signature: bufferToBase64url(response.signature),
    authenticatorData: bufferToBase64url(response.authenticatorData),
    clientDataJSON: bufferToBase64url(response.clientDataJSON),
  };
}

// ─── Session Verification State ─────────────────────────────────────────────────

/**
 * Mark the current session as verified.
 * Stored in sessionStorage — clears when browser tab closes.
 */
export function setVerified(method: VerificationMethod): void {
  const state = {
    isVerified: true,
    method,
    verifiedAt: Date.now(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

/**
 * Check if the current session is still verified (within timeout).
 */
export function isSessionVerified(): { verified: boolean; method: VerificationMethod } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { verified: false, method: "none" };

    const state = JSON.parse(raw);
    if (!state.isVerified || !state.verifiedAt) return { verified: false, method: "none" };

    // Check timeout
    const elapsed = Date.now() - state.verifiedAt;
    if (elapsed > VERIFICATION_TIMEOUT_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return { verified: false, method: "none" };
    }

    return { verified: true, method: state.method };
  } catch {
    return { verified: false, method: "none" };
  }
}

/**
 * Clear verification state (lock the session)
 */
export function clearVerification(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Refresh the verification timestamp (call on successful document access)
 */
export function refreshVerification(): void {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    state.verifiedAt = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// ─── Buffer Utilities ───────────────────────────────────────────────────────────

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
