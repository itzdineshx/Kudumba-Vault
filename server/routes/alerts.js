import { Router } from "express";
import Alert from "../models/Alert.js";
import { auth } from "../middleware/auth.js";

const router = Router();
router.use(auth);

// GET /api/alerts
router.get("/", async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.userId }).sort({ timestamp: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// POST /api/alerts
router.post("/", async (req, res) => {
  try {
    const { type, description, status, ip, details } = req.body;
    if (!type || !description) {
      return res.status(400).json({ error: "Type and description are required" });
    }
    const alert = await Alert.create({
      userId: req.userId,
      type,
      description,
      status: status || "warning",
      ip: ip || "",
      details: details || "",
    });
    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: "Failed to create alert" });
  }
});

export default router;
