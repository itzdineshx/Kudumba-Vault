import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Alert from "../models/Alert.js";
import { generateToken, auth } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/register — owner registration (creates family with unique Family ID)
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

    // Generate unique Family ID
    let familyId;
    let attempts = 0;
    do {
      familyId = User.generateFamilyId();
      const exists = await User.findOne({ familyId, role: "owner" });
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    const user = await User.create({ name, email, passwordHash, familyName, familyId, role: "owner", status: "approved" });
    const token = generateToken(user._id.toString(), user.email);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, familyName: user.familyName, role: user.role, familyId: user.familyId },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/join — member self-registration using Family ID
router.post("/join", async (req, res) => {
  try {
    const { name, email, password, familyId, relationship } = req.body;
    if (!name || !email || !password || !familyId || !relationship) {
      return res.status(400).json({ error: "Name, email, password, family ID, and relationship are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Find the family owner by familyId
    const owner = await User.findOne({ familyId: familyId.toUpperCase(), role: "owner" });
    if (!owner) {
      return res.status(404).json({ error: "Invalid Family ID. No family found with this code." });
    }

    // Check if email already registered
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      passwordHash,
      familyName: owner.familyName,
      familyId: owner.familyId,
      role: "member",
      status: "pending",
      relationship,
    });

    // Create an alert for the family owner about the join request
    await Alert.create({
      userId: owner._id,
      type: "member_request",
      description: `${name} (${relationship}) wants to join your family vault.`,
      status: "warning",
      details: JSON.stringify({ memberId: user._id, name, email, relationship }),
    });

    res.status(201).json({
      message: "Join request sent! The family head will review and approve your request.",
      pending: true,
    });
  } catch (err) {
    console.error("Join error:", err);
    res.status(500).json({ error: "Failed to submit join request" });
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

    // Block pending/rejected members from logging in
    if (user.status === "pending") {
      return res.status(403).json({ error: "Your join request is pending approval from the family head." });
    }
    if (user.status === "rejected") {
      return res.status(403).json({ error: "Your join request was not approved." });
    }

    const token = generateToken(user._id.toString(), user.email);

    const response = {
      token,
      user: { id: user._id, name: user.name, email: user.email, familyName: user.familyName, role: user.role },
    };

    if (user.role === "member" && user.encryptedWallet?.encryptedKey) {
      response.encryptedWallet = {
        encryptedKey: user.encryptedWallet.encryptedKey,
        salt: user.encryptedWallet.salt,
        address: user.walletAddress,
        version: user.encryptedWallet.version || 1,
      };
    }

    res.json(response);
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

    // Auto-generate familyId for existing owners who don't have one
    if (user.role === "owner" && !user.familyId) {
      let familyId;
      let attempts = 0;
      do {
        familyId = User.generateFamilyId();
        const exists = await User.findOne({ familyId, role: "owner" });
        if (!exists) break;
        attempts++;
      } while (attempts < 10);
      user.familyId = familyId;
      await user.save();
    }

    const profile = { id: user._id, name: user.name, email: user.email, familyName: user.familyName, role: user.role };
    if (user.walletAddress) profile.walletAddress = user.walletAddress;
    if (user.familyId) profile.familyId = user.familyId;
    res.json(profile);
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
