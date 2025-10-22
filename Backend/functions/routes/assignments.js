const express = require("express");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");
const assignmentController = require("../controllers/assignmentController");

const router = express.Router();

router.use(authenticate);
router.post(
  "/:customerId/status",
  authorizeRoles("customer", "user", "coach", "kwaliteitscoordinator", "assessor"),
  assignmentController.updateAssignmentStatus
);

module.exports = router;
