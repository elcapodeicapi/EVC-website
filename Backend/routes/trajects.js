const express = require("express");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");
const trajectController = require("../controllers/trajectController");

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("admin"));

router.get("/", trajectController.listTrajects);
router.post("/", trajectController.createTraject);

module.exports = router;
