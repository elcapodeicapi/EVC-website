const express = require("express");
const multer = require("multer");
const path = require("path");
const { Evidence } = require("../Models");
const { authenticate } = require("../Middleware/authMiddleware");

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// POST /evidence/upload
router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    const { name = "", type = null } = req.body;
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

    res.json(evidence);
  } catch (err) {
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({ error: err.errors?.[0]?.message || "Validation error" });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
