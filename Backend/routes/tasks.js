const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");

// GET all tasks
router.get("/", taskController.getAllTasks);

// GET single task
router.get("/:id", taskController.getTask);

// POST response for a task
router.post("/:id/response", taskController.saveResponse);

module.exports = router;
