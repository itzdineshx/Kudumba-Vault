import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = Router();
router.use(auth);

// ─── Helper: Get all family members ─────────────────────────────────────────

async function getFamilyMembers(userId) {
  const user = await User.findById(userId).select("familyId role");
  if (!user || !user.familyId) return { user, members: [user] };
  const members = await User.find({ familyId: user.familyId, status: "approved" });
  return { user, members };
}

async function getFamilyOwner(userId) {
  const user = await User.findById(userId).select("familyId role");
  if (!user || !user.familyId) return user;
  if (user.role === "owner") return user;
  return await User.findOne({ familyId: user.familyId, role: "owner" });
}

// ─── PIN Management (family-synced: PIN is stored on the family owner) ──────

// POST /api/verification/pin/setup — Set or update family PIN
router.post("/pin/setup", async (req, res) => {
  try {
    const { pinHash } = req.body;
    if (!pinHash || typeof pinHash !== "string" || pinHash.length !== 64) {
      return res.status(400).json({ error: "Invalid PIN hash" });
    }

    // Store the PIN on the family owner (single source of truth)
    const owner = await getFamilyOwner(req.userId);
    if (!owner) return res.status(404).json({ error: "Family owner not found" });

    const serverHash = await bcrypt.hash(pinHash, 10);
    await User.findByIdAndUpdate(owner._id, { pinHash: serverHash });

    res.json({ success: true });
  } catch (err) {
    console.error("PIN setup error:", err);
    res.status(500).json({ error: "Failed to set up PIN" });
  }
});

// POST /api/verification/pin/verify — Verify PIN (checks family owner's PIN)
router.post("/pin/verify", async (req, res) => {
  try {
    const { pinHash } = req.body;
    if (!pinHash) return res.status(400).json({ error: "PIN hash is required" });

    const owner = await getFamilyOwner(req.userId);
    if (!owner) return res.status(404).json({ error: "Family owner not found" });

    const ownerDoc = await User.findById(owner._id).select("pinHash");
    if (!ownerDoc?.pinHash) return res.status(400).json({ error: "PIN not set up" });

    const valid = await bcrypt.compare(pinHash, ownerDoc.pinHash);
    if (!valid) return res.status(401).json({ error: "Invalid PIN" });

    res.json({ success: true, verified: true });
  } catch (err) {
    console.error("PIN verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// DELETE /api/verification/pin — Remove family PIN
router.delete("/pin", async (req, res) => {
  try {
    const owner = await getFamilyOwner(req.userId);
    if (!owner) return res.status(404).json({ error: "Family owner not found" });

    await User.findByIdAndUpdate(owner._id, { pinHash: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove PIN" });
  }
});

// ─── Biometric (WebAuthn) Management (family-synced) ────────────────────────

// GET /api/verification/biometric/challenge — Get a fresh challenge
router.get("/biometric/challenge", async (req, res) => {
  try {
    const challenge = crypto.randomBytes(32).toString("base64");
    await User.findByIdAndUpdate(req.userId, {
      $set: { _pendingChallenge: challenge, _challengeExpiry: Date.now() + 120000 }
    });
    res.json({ challenge });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate challenge" });
  }
});

// POST /api/verification/biometric/register — Register a biometric credential (stored on current user, shared across family)
router.post("/biometric/register", async (req, res) => {
  try {
    const { credentialId, publicKey, deviceName } = req.body;
    if (!credentialId || !publicKey) {
      return res.status(400).json({ error: "Credential data is required" });
    }

    const user = await User.findById(req.userId).select("name");
    const label = `${deviceName || "Biometric Device"} (${user?.name || "Unknown"})`;

    await User.findByIdAndUpdate(req.userId, {
      $push: {
        biometricCredentials: {
          credentialId,
          publicKey,
          deviceName: label,
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

// POST /api/verification/biometric/verify — Verify biometric (checks all family members' credentials)
router.post("/biometric/verify", async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) return res.status(400).json({ error: "Credential ID is required" });

    const { members } = await getFamilyMembers(req.userId);
    const matched = members.some(m =>
      m.biometricCredentials?.some(c => c.credentialId === credentialId)
    );

    if (!matched) {
      return res.status(401).json({ error: "Unrecognized biometric credential" });
    }

    res.json({ success: true, verified: true });
  } catch (err) {
    console.error("Biometric verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// DELETE /api/verification/biometric/:credentialId — Remove a biometric credential (from any family member)
router.delete("/biometric/:credentialId", async (req, res) => {
  try {
    const { members } = await getFamilyMembers(req.userId);
    // Remove from whichever family member has it
    for (const m of members) {
      await User.findByIdAndUpdate(m._id, {
        $pull: { biometricCredentials: { credentialId: req.params.credentialId } }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove biometric" });
  }
});

// ─── Status (family-aggregated) ─────────────────────────────────────────────

// GET /api/verification/status — Check what verification methods are set up (family-wide)
router.get("/status", async (req, res) => {
  try {
    const owner = await getFamilyOwner(req.userId);
    const ownerDoc = owner ? await User.findById(owner._id).select("pinHash") : null;

    const { members } = await getFamilyMembers(req.userId);
    // Aggregate all biometric devices across the family
    const allDevices = members.flatMap(m =>
      (m.biometricCredentials || []).map(c => ({
        credentialId: c.credentialId,
        deviceName: c.deviceName,
        registeredAt: c.registeredAt,
      }))
    );

    res.json({
      hasPin: !!(ownerDoc?.pinHash),
      hasBiometric: allDevices.length > 0,
      biometricDevices: allDevices,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get verification status" });
  }
});

export default router;
