import { Router } from "express";
import bcrypt from "bcryptjs";
import Member from "../models/Member.js";
import User from "../models/User.js";
import Alert from "../models/Alert.js";
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

// GET /api/members/pending — list pending join requests for this owner's family
// MUST be defined before /:id routes so Express doesn't match "pending" as an id
router.get("/pending", async (req, res) => {
  try {
    const owner = await User.findById(req.userId);
    if (!owner || owner.role !== "owner") {
      return res.status(403).json({ error: "Only the family owner can view pending requests" });
    }

    const pending = await User.find({
      familyId: owner.familyId,
      role: "member",
      status: "pending",
    }).select("-passwordHash").sort({ createdAt: -1 });

    res.json(pending.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      relationship: u.relationship,
      createdAt: u.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending requests" });
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
      familyId: owner.familyId,
      role: "member",
      status: "approved",
      relationship,
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

// POST /api/members/:id/approve — approve a pending member and create Member record
router.post("/:id/approve", async (req, res) => {
  try {
    const owner = await User.findById(req.userId);
    if (!owner || owner.role !== "owner") {
      return res.status(403).json({ error: "Only the family owner can approve members" });
    }

    const pendingUser = await User.findOne({
      _id: req.params.id,
      familyId: owner.familyId,
      role: "member",
      status: "pending",
    });
    if (!pendingUser) {
      return res.status(404).json({ error: "Pending request not found" });
    }

    // Accept optional encrypted wallet from the owner's client
    const { encryptedWallet } = req.body;
    const walletAddress = encryptedWallet?.address || null;

    // Update user status to approved and store wallet if provided
    pendingUser.status = "approved";
    if (walletAddress) pendingUser.walletAddress = walletAddress;
    if (encryptedWallet) {
      pendingUser.encryptedWallet = {
        encryptedKey: encryptedWallet.encryptedKey,
        salt: encryptedWallet.salt,
        version: encryptedWallet.version || 1,
      };
    }
    await pendingUser.save();

    // Create a Member record linked to the owner
    const avatarInitials = pendingUser.name.split(" ").map(n => n[0]).join("").toUpperCase();
    const member = await Member.create({
      userId: req.userId,
      name: pendingUser.name,
      email: pendingUser.email,
      relationship: pendingUser.relationship || "Family",
      role: "member",
      avatarInitials,
      walletAddress,
      memberUserId: pendingUser._id,
      encryptedWallet: encryptedWallet ? {
        encryptedKey: encryptedWallet.encryptedKey,
        salt: encryptedWallet.salt,
        version: encryptedWallet.version || 1,
      } : undefined,
    });

    // Alert the approved member
    await Alert.create({
      userId: pendingUser._id,
      type: "approval",
      description: "Your request to join the family vault has been approved! You can now log in.",
      status: "resolved",
    });

    res.json(member);
  } catch (err) {
    console.error("Approve member error:", err);
    res.status(500).json({ error: "Failed to approve member" });
  }
});

// POST /api/members/:id/reject — reject a pending member
router.post("/:id/reject", async (req, res) => {
  try {
    const owner = await User.findById(req.userId);
    if (!owner || owner.role !== "owner") {
      return res.status(403).json({ error: "Only the family owner can reject members" });
    }

    const pendingUser = await User.findOne({
      _id: req.params.id,
      familyId: owner.familyId,
      role: "member",
      status: "pending",
    });
    if (!pendingUser) {
      return res.status(404).json({ error: "Pending request not found" });
    }

    pendingUser.status = "rejected";
    await pendingUser.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reject member" });
  }
});

export default router;
