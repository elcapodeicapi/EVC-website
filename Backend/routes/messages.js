const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");

const messagingRoles = ["admin", "coach", "customer", "user"];

router.get("/", authenticate, authorizeRoles(...messagingRoles), messageController.getAllMessages);
router.post("/send", authenticate, authorizeRoles(...messagingRoles), messageController.sendMessage);

module.exports = router;
