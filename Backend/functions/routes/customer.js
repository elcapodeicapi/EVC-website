const express = require("express");
const router = express.Router();
const customerProfileController = require("../controllers/customerProfileController");
const trajectController = require("../controllers/trajectController");
const careerGoalController = require("../controllers/careerGoalController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");

router.use(authenticate);
router.use(authorizeRoles("customer"));

router.get("/profile", customerProfileController.getProfile);
router.put("/profile", customerProfileController.updateProfile);
router.get("/planning", trajectController.getCustomerPlanning);
router.get("/career-goal", careerGoalController.getCareerGoal);
router.put("/career-goal", careerGoalController.updateCareerGoal);

module.exports = router;
