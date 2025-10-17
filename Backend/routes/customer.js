const express = require("express");
const multer = require("multer");
const router = express.Router();
const customerProfileController = require("../controllers/customerProfileController");
const trajectController = require("../controllers/trajectController");
const careerGoalController = require("../controllers/careerGoalController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");

const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);
router.use(authorizeRoles("customer"));

router.get("/profile", customerProfileController.getProfile);
router.put("/profile", customerProfileController.updateProfile);
router.post(
	"/profile/certificates/upload",
	upload.single("file"),
	customerProfileController.uploadCertificate
);
router.post(
	"/profile/photo",
	upload.single("file"),
	customerProfileController.uploadProfilePhoto
);
router.get("/planning", trajectController.getCustomerPlanning);
router.get("/career-goal", careerGoalController.getCareerGoal);
router.put("/career-goal", careerGoalController.updateCareerGoal);

module.exports = router;
