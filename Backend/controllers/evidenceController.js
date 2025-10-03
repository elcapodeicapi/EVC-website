const { Evidence } = require("../Models");

// GET /evidence -> list evidence
exports.getAllEvidence = async (req, res) => {
  try {
    const evidence = await Evidence.findAll();
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /evidence/upload -> upload file (multer handles the file)
exports.uploadEvidence = async (req, res) => {
  try {
    const ev = await Evidence.create({
      name: req.body.name || req.file.originalname,
      type: req.body.type,
      file_path: req.file.path
    });
    res.json(ev);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /evidence/:id -> delete evidence
exports.deleteEvidence = async (req, res) => {
  try {
    const ev = await Evidence.findByPk(req.params.id);
    if (!ev) return res.status(404).json({ error: "Not found" });
    await ev.destroy();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
