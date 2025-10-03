const { Response } = require("../Models");

// GET /responses/:taskId
exports.getResponseForTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id; // from auth middleware

    const response = await Response.findOne({
      where: { TaskId: taskId, UserId: userId },
    });

    res.json(response || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST or PUT /responses/:taskId
exports.saveOrUpdateResponse = async (req, res) => {
  try {
    const { taskId } = req.params;
  // Accept both current { notes } and legacy { responseText }
  const notes = (req.body.notes !== undefined ? req.body.notes : req.body.responseText) ?? null;
    const userId = req.user.id;

    // check if response exists for this user and task
    let response = await Response.findOne({ where: { TaskId: taskId, UserId: userId } });

    if (response) {
      if (notes !== null) response.notes = notes;
      await response.save();
    } else {
      // create new
      response = await Response.create({ TaskId: taskId, UserId: userId, notes });
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
