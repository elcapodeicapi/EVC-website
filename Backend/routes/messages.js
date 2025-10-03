const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { authenticate } = require("../Middleware/authMiddleware");

router.get("/", authenticate, messageController.getAllMessages);
router.post("/send", authenticate, messageController.sendMessage);

module.exports = router;
