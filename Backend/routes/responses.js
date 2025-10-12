const express = require("express");
const router = express.Router();
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");
const responseController = require("../controllers/responseController");

router.get(
	"/:taskId",
	authenticate,
	authorizeRoles("admin", "coach", "customer", "user"),
	responseController.getResponseForTask
);
router.post(
	"/:taskId",
	authenticate,
	authorizeRoles("admin", "coach", "customer", "user"),
	responseController.saveOrUpdateResponse
);

module.exports = router;
