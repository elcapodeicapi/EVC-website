const express = require("express");
const router = express.Router();
const { authenticate } = require("../Middleware/authMiddleware");
const responseController = require("../controllers/responseController");

router.get("/:taskId", authenticate, responseController.getResponseForTask);
router.post("/:taskId", authenticate, responseController.saveOrUpdateResponse);

module.exports = router;
