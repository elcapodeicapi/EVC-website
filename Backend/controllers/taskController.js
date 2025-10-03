const { Task, Response } = require("../Models");

// GET /tasks -> list all tasks
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({ include: Response });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /tasks/:id -> get single task
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id, { include: Response });
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /tasks/:id/response -> save response (notes only)
exports.saveResponse = async (req, res) => {
  try {
    const { notes, responseText } = req.body;
    const response = await Response.create({
      TaskId: req.params.id,
      notes: notes !== undefined ? notes : responseText
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
