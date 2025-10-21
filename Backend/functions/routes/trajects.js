const express = require("express");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");
const trajectController = require("../controllers/trajectController");

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("admin"));

router.get("/", trajectController.listTrajects);
router.get("/:id", trajectController.getTraject);
router.post("/", trajectController.createTraject);
router.put("/:id", trajectController.updateTraject);

module.exports = router;
