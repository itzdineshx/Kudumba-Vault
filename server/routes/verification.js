import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = Router();
router.use(auth);

// ─── PIN Management ─────────────────────────────────────────────────────────

// POST /api/verification/pin/setup — Set or update PIN
// PIN arrives already SHA-256 hashed from the client, then we bcrypt it server-side
router.post("/pin/setup", async (req, res) => {
  try {
    const { pinHash } = req.body;
    if (!pinHash || typeof pinHash !== "string" || pinHash.length !== 64) {
      return res.status(400).json({ error: "Invalid PIN hash" });
    }

    // Double-hash with bcrypt for server-side storage
    const serverHash = await bcrypt.hash(pinHash, 10);
    await User.findByIdAndUpdate(req.userId, { pinHash: serverHash });

    res.json({ success: true });
  } catch (err) {
    console.error("PIN setup error:", err);
    res.status(500).json({ error: "Failed to set up PIN" });
  }
});

// POST /api/verification/pin/verify — Verify PIN
router.post("/pin/verify", async (req, res) => {
  try {
    const { pinHash } = req.body;
    if (!pinHash) return res.status(400).json({ error: "PIN hash is required" });

    const user = await User.findById(req.userId);
    if (!user?.pinHash) return res.status(400).json({ error: "PIN not set up" });

    const valid = await bcrypt.compare(pinHash, user.pinHash);
    if (!valid) return res.status(401).json({ error: "Invalid PIN" });

    res.json({ success: true, verified: true });
  } catch (err) {
    console.error("PIN verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// DELETE /api/verification/pin — Remove PIN
router.delete("/pin", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { pinHash: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove PIN" });
  }
});

// ─── Biometric (WebAuthn) Management ────────────────────────────────────────

// GET /api/verification/biometric/challenge — Get a fresh challenge for registration or verification
router.get("/biometric/challenge", async (req, res) => {
  try {
    const challenge = crypto.randomBytes(32).toString("base64");
    // Store in a simple in-memory map (production: use Redis/session store)
    // For now, we store it on the user temporarily
    await User.findByIdAndUpdate(req.userId, {
      $set: { _pendingChallenge: challenge, _challengeExpiry: Date.now() + 120000 }
    });
    res.json({ challenge });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate challenge" });
  }
});

// POST /api/verification/biometric/register — Register a new biometric credential
router.post("/biometric/register", async (req, res) => {
  try {
    const { credentialId, publicKey, deviceName } = req.body;
    if (!credentialId || !publicKey) {
      return res.status(400).json({ error: "Credential data is required" });
    }

    await User.findByIdAndUpdate(req.userId, {
      $push: {
        biometricCredentials: {
          credentialId,
          publicKey,
          deviceName: deviceName || "Biometric Device",
          registeredAt: new Date(),
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Biometric register error:", err);
    res.status(500).json({ error: "Failed to register biometric" });
  }
});

// POST /api/verification/biometric/verify — Verify biometric assertion
// In a production system, we'd verify the signature against the stored public key.
// For this implementation, we verify the credential ID matches a registered one
// and trust the platform authenticator's user verification.
router.post("/biometric/verify", async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) return res.status(400).json({ error: "Credential ID is required" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const matchedCred = user.biometricCredentials?.find(
      c => c.credentialId === credentialId
    );

    if (!matchedCred) {
      return res.status(401).json({ error: "Unrecognized biometric credential" });
    }

    res.json({ success: true, verified: true });
  } catch (err) {
    console.error("Biometric verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// DELETE /api/verification/biometric/:credentialId — Remove a biometric credential
router.delete("/biometric/:credentialId", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $pull: { biometricCredentials: { credentialId: req.params.credentialId } }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove biometric" });
  }
});

// ─── Status ─────────────────────────────────────────────────────────────────

// GET /api/verification/status — Check what verification methods are set up
router.get("/status", async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("pinHash biometricCredentials");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      hasPin: !!user.pinHash,
      hasBiometric: !!(user.biometricCredentials && user.biometricCredentials.length > 0),
      biometricDevices: (user.biometricCredentials || []).map(c => ({
        credentialId: c.credentialId,
        deviceName: c.deviceName,
        registeredAt: c.registeredAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get verification status" });
  }
});

export default router;
