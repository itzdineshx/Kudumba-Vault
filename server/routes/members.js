import { Router } from "express";
import Member from "../models/Member.js";
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
router.post("/", async (req, res) => {
  try {
    const { name, email, relationship, walletAddress } = req.body;
    if (!name || !email || !relationship) {
      return res.status(400).json({ error: "Name, email, and relationship are required" });
    }
    const avatarInitials = name.split(" ").map(n => n[0]).join("").toUpperCase();
    const member = await Member.create({
      userId: req.userId,
      name,
      email,
      relationship,
      role: "member",
      avatarInitials,
      walletAddress: walletAddress || undefined,
    });
    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: "Failed to add member" });
  }
});

// DELETE /api/members/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await Member.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!result) return res.status(404).json({ error: "Member not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove member" });
  }
});

export default router;
