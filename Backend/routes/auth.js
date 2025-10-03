const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../Middleware/authMiddleware");


router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);
module.exports = router;
