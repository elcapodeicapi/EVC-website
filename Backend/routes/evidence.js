const express = require("express");
const multer = require("multer");
const path = require("path");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");
const { db: adminDb } = require("../firebase");
const { uploadBuffer, sanitizeFilename, bucket } = require("../utils/storage");

const router = express.Router();

// Multer setup (memory storage for direct upload to Firebase Storage)
const upload = multer({ storage: multer.memoryStorage() });

function buildStoragePath(uid, originalName) {
  const safeName = sanitizeFilename(originalName || "upload.bin");
  return path.posix.join("uploads", uid, `${Date.now()}-${safeName}`);
}

// POST /evidence/upload
router.post(
  "/upload",
  authenticate,
  authorizeRoles("admin", "coach", "customer", "user"),
  upload.single("file"),
  async (req, res) => {
    try {
      const { name = "", type = null, competencyId = null, trajectId: bodyTrajectId = null } = req.body;
      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ error: "Name is required" });
      }

      const firebaseUid = req.user.firebaseUid || req.user.uid || null;
      if (!firebaseUid) {
        return res.status(400).json({ error: "Missing Firebase user id" });
      }

      const trajectId = bodyTrajectId || null;
      const now = new Date();

      const destination = buildStoragePath(firebaseUid, req.file.originalname || req.file.filename);
      const { file, downloadUrl } = await uploadBuffer(destination, req.file.buffer, {
        contentType: req.file.mimetype,
        metadata: {
          firebaseUid,
          trajectId: trajectId || undefined,
          competencyId: competencyId || undefined,
          originalName: req.file.originalname,
        },
      });

      const payload = {
        name: trimmedName,
        filePath: downloadUrl,
        downloadUrl,
        storagePath: file.name,
        bucket: bucket.name,
        type: type || null,
        contentType: req.file.mimetype || null,
        size: typeof req.file.size === "number" ? req.file.size : null,
        competencyId: competencyId || null,
        trajectId,
        uploadedAt: now,
      };

      const docRef = await adminDb
        .collection("users")
        .doc(firebaseUid)
        .collection("uploads")
        .add(payload);

      res.json({ id: docRef.id, ...payload });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
