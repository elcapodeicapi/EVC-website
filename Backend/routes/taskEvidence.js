const express = require("express");
const { UniqueConstraintError } = require("sequelize");
const { TaskEvidence, Evidence, Task } = require("../Models");
const { authenticate } = require("../Middleware/authMiddleware");

const router = express.Router();

// POST /taskevidence/assign
router.post("/assign", authenticate, async (req, res) => {
  try {
    const taskId = parseInt(req.body.taskId, 10);
    const evidenceId = parseInt(req.body.evidenceId, 10);
    if (!Number.isInteger(taskId) || !Number.isInteger(evidenceId)) {
      return res.status(400).json({ error: "Invalid taskId or evidenceId" });
    }

    // Ensure referenced records exist (avoid FK errors)
    const [task, evidence] = await Promise.all([
      Task.findByPk(taskId),
      Evidence.findByPk(evidenceId),
    ]);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (!evidence) return res.status(404).json({ error: "Evidence not found" });

    // Try idempotent create: return existing if already linked
    const existing = await TaskEvidence.findOne({ where: { TaskId: taskId, EvidenceId: evidenceId } });
    if (existing) {
      return res.status(200).json({ ...existing.toJSON(), created: false });
    }

    try {
      const link = await TaskEvidence.create({ TaskId: taskId, EvidenceId: evidenceId });
      return res.status(201).json({ ...link.toJSON(), created: true });
    } catch (createErr) {
      if (createErr instanceof UniqueConstraintError) {
        const after = await TaskEvidence.findOne({ where: { TaskId: taskId, EvidenceId: evidenceId } });
        if (after) return res.status(200).json({ ...after.toJSON(), created: false });
      }
      throw createErr;
    }
  } catch (err) {
    res.status(500).json({
      error: err.message,
      name: err.name,
      code: err.code,
      sql: err.sql,
    });
  }
});

module.exports = router;

// GET /taskevidence/by-task/:taskId -> list evidence linked to a task
router.get("/by-task/:taskId", authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findByPk(taskId, {
      include: [{ model: Evidence, through: { attributes: [] } }],
    });
    if (!task) return res.status(404).json({ error: "Task not found" });
    const list = task.Evidences || task.Evidence || [];
    res.json(list);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      name: err.name,
      code: err.code,
      sql: err.sql,
    });
  }
});
