import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { generateToken, auth } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, familyName } = req.body;
    if (!name || !email || !password || !familyName) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, familyName, role: "owner" });
    const token = generateToken(user._id.toString(), user.email);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, familyName: user.familyName, role: user.role },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = generateToken(user._id.toString(), user.email);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, familyName: user.familyName, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/auth/me — get current user profile
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user._id, name: user.name, email: user.email, familyName: user.familyName, role: user.role });
  } catch (err) {
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// GET /api/auth/check — check if any users exist (for isFirstTime)
router.get("/check", async (_req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ hasUsers: count > 0 });
  } catch (err) {
    res.status(500).json({ error: "Check failed" });
  }
});

export default router;
