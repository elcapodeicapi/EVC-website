const express = require("express");
const multer = require("multer");
const path = require("path");
const { Evidence, User } = require("../Models");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");
const { db: adminDb } = require("../firebase");

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

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

      const file_path = "/uploads/" + req.file.filename;

      const evidence = await Evidence.create({
        name: trimmedName,
        type,
        file_path,
        UserId: req.user.id,
      });

      if (competencyId) {
        const user = await User.findByPk(req.user.id);
        if (user?.firebaseUid) {
          const trajectId = bodyTrajectId || user.trajectId || null;
          const evidenceDoc = {
            userId: user.firebaseUid,
            sqlEvidenceId: evidence.id,
            competencyId,
            trajectId,
            name: trimmedName,
            filePath: file_path,
            type: type || null,
            createdAt: new Date(),
          };
          await adminDb.collection("evidences").add(evidenceDoc);
        }
      }

      res.json(evidence);
    } catch (err) {
      if (err.name === "SequelizeValidationError") {
        return res.status(400).json({ error: err.errors?.[0]?.message || "Validation error" });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
