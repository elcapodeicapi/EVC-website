const express = require("express");
const multer = require("multer");
const router = express.Router();
const customerProfileController = require("../controllers/customerProfileController");
const trajectController = require("../controllers/trajectController");
const careerGoalController = require("../controllers/careerGoalController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 },
});

function handleUpload(fieldName) {
	const singleUpload = upload.single(fieldName);
	return (req, res, next) => {
		singleUpload(req, res, (err) => {
			if (err) {
				const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
				return res.status(status).json({ error: err.message || "Bestand kon niet worden verwerkt" });
			}
			return next();
		});
	};
}

router.use(authenticate);
router.use(authorizeRoles("customer"));

router.get("/profile", customerProfileController.getProfile);
router.put("/profile", customerProfileController.updateProfile);
router.post(
	"/profile/certificates/upload",
	handleUpload("file"),
	customerProfileController.uploadCertificate
);
router.post(
	"/profile/photo",
	handleUpload("file"),
	customerProfileController.uploadProfilePhoto
);
router.get("/planning", trajectController.getCustomerPlanning);
router.get("/career-goal", careerGoalController.getCareerGoal);
router.put("/career-goal", careerGoalController.updateCareerGoal);

module.exports = router;
