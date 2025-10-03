const express = require("express");
const { TaskEvidence } = require("../Models");
const { authenticate } = require("../Middleware/authMiddleware");

const router = express.Router();

// POST /taskevidence/assign
router.post("/assign", authenticate, async (req, res) => {
  try {
    const { taskId, evidenceId } = req.body;

    const link = await TaskEvidence.create({ TaskId: taskId, EvidenceId: evidenceId });
    res.json(link);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
