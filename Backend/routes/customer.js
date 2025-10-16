const express = require("express");
const multer = require("multer");
const router = express.Router();
const customerProfileController = require("../controllers/customerProfileController");
const trajectController = require("../controllers/trajectController");
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
router.get("/planning", trajectController.getCustomerPlanning);

module.exports = router;
