const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");

// GET all tasks
router.get(
	"/",
	authenticate,
	authorizeRoles("admin", "coach", "customer", "user"),
	taskController.getAllTasks
);

// GET single task
router.get(
	"/:id",
	authenticate,
	authorizeRoles("admin", "coach", "customer", "user"),
	taskController.getTask
);

// POST response for a task
router.post(
	"/:id/response",
	authenticate,
	authorizeRoles("customer", "user", "coach"),
	taskController.saveResponse
);

module.exports = router;
