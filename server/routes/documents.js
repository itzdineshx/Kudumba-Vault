import { Router } from "express";
import multer from "multer";
import Document from "../models/Document.js";
import { auth } from "../middleware/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// All routes require auth
router.use(auth);

// GET /api/documents — list user's documents
router.get("/", async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.userId }).sort({ timestamp: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// POST /api/documents — create document (with optional encrypted file)
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { name, category, privacy, hash, fileType, size, encryptionKey, blockchain, originalName, mimeType } = req.body;

    const docData = {
      userId: req.userId,
      name,
      category,
      privacy: privacy || "private",
      hash,
      fileType: fileType || "Text",
      size: size || "0 B",
      encryptionKey,
      originalName,
      mimeType,
      accessLog: [{
        userId: "owner",
        userName: req.body.userName || "Owner",
        action: "Uploaded document",
        timestamp: new Date().toISOString(),
      }],
    };

    // Parse blockchain data if provided as JSON string
    if (blockchain) {
      try {
        docData.blockchain = typeof blockchain === "string" ? JSON.parse(blockchain) : blockchain;
      } catch { docData.blockchain = blockchain; }
    }

    // Store encrypted file data if uploaded
    if (req.file) {
      docData.fileData = req.file.buffer;
    } else if (req.body.fileData) {
      // fileData sent as base64
      docData.fileData = Buffer.from(req.body.fileData, "base64");
    }

    const doc = await Document.create(docData);
    res.status(201).json(doc);
  } catch (err) {
    console.error("Create document error:", err);
    res.status(500).json({ error: "Failed to create document" });
  }
});

// GET /api/documents/:id — get document (without file data)
router.get("/:id", async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// GET /api/documents/:id/file — download encrypted file data
router.get("/:id/file", async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.userId }).select("+fileData");
    if (!doc || !doc.fileData) return res.status(404).json({ error: "File not found" });
    res.set("Content-Type", "application/octet-stream");
    res.set("Content-Disposition", `attachment; filename="${doc.originalName || doc.name}"`);
    res.send(doc.fileData);
  } catch (err) {
    res.status(500).json({ error: "Failed to download file" });
  }
});

// PATCH /api/documents/:id — update document (blockchain, sharing, etc.)
router.patch("/:id", async (req, res) => {
  try {
    const updates = {};
    const { blockchain, privacy, sharedWith, accessLog } = req.body;

    if (blockchain) updates.blockchain = blockchain;
    if (privacy) updates.privacy = privacy;
    if (sharedWith) updates.sharedWith = sharedWith;
    if (accessLog) updates.accessLog = accessLog;

    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: updates },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to update document" });
  }
});

// POST /api/documents/:id/share
router.post("/:id/share", async (req, res) => {
  try {
    const { memberId, permission, expiresAt, memberName, userName } = req.body;

    const doc = await Document.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ error: "Document not found" });

    // Remove existing access for this member, add new
    const filtered = doc.sharedWith.filter(s => s.memberId !== memberId);
    filtered.push({ memberId, permission, grantedAt: new Date().toISOString(), expiresAt, revoked: false });

    doc.sharedWith = filtered;
    doc.privacy = "shared";
    doc.accessLog.push({
      userId: "owner",
      userName: userName || "Owner",
      action: `Shared with ${memberName || memberId}`,
      timestamp: new Date().toISOString(),
    });

    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to share document" });
  }
});

// POST /api/documents/:id/revoke
router.post("/:id/revoke", async (req, res) => {
  try {
    const { memberId } = req.body;
    const doc = await Document.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ error: "Document not found" });

    doc.sharedWith = doc.sharedWith.map(s =>
      s.memberId === memberId ? { ...s.toObject(), revoked: true } : s
    );
    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

// DELETE /api/documents/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await Document.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!result) return res.status(404).json({ error: "Document not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
