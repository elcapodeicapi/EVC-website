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
    const { name, type } = req.body;
    const file_path = "/uploads/" + req.file.filename;

    const evidence = await Evidence.create({
      name,
      type,
      file_path,
      UserId: req.user.id,
    });

    res.json(evidence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
