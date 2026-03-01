import { Router } from "express";
import bcrypt from "bcryptjs";
import Member from "../models/Member.js";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = Router();
router.use(auth);

// GET /api/members
router.get("/", async (req, res) => {
  try {
    const members = await Member.find({ userId: req.userId }).sort({ addedAt: -1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// POST /api/members
// When owner adds a member, we also create a User account for them
// so they can log in. The encrypted wallet (generated client-side) is
// stored on both Member and User records.
router.post("/", async (req, res) => {
  try {
    const { name, email, relationship, password, encryptedWallet } = req.body;
    if (!name || !email || !relationship) {
      return res.status(400).json({ error: "Name, email, and relationship are required" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "A password (min 6 chars) is required for the member account" });
    }

    // Check if a user already exists with this email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    // Get the owner's familyName so the member is in the same family
    const owner = await User.findById(req.userId);
    if (!owner) return res.status(404).json({ error: "Owner not found" });

    const avatarInitials = name.split(" ").map(n => n[0]).join("").toUpperCase();
    const walletAddress = encryptedWallet?.address || undefined;

    // 1. Create User account for the member
    const passwordHash = await bcrypt.hash(password, 12);
    const memberUser = await User.create({
      name,
      email,
      passwordHash,
      familyName: owner.familyName,
      role: "member",
      walletAddress: walletAddress || null,
      encryptedWallet: encryptedWallet ? {
        encryptedKey: encryptedWallet.encryptedKey,
        salt: encryptedWallet.salt,
        version: encryptedWallet.version || 1,
      } : undefined,
    });

    // 2. Create Member record linked to the owner
    const member = await Member.create({
      userId: req.userId,
      name,
      email,
      relationship,
      role: "member",
      avatarInitials,
      walletAddress,
      encryptedWallet: encryptedWallet ? {
        encryptedKey: encryptedWallet.encryptedKey,
        salt: encryptedWallet.salt,
        version: encryptedWallet.version || 1,
      } : undefined,
      memberUserId: memberUser._id,
    });

    res.status(201).json(member);
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// DELETE /api/members/:id
// Also removes the associated User account for the member
router.delete("/:id", async (req, res) => {
  try {
    const member = await Member.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!member) return res.status(404).json({ error: "Member not found" });

    // Also remove their user account
    if (member.email) {
      await User.findOneAndDelete({ email: member.email, role: "member" });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove member" });
  }
});

export default router;
