const express = require("express");
const path = require("path");
const multer = require("multer");
const router = express.Router();
const customerProfileController = require("../controllers/customerProfileController");
const trajectController = require("../controllers/trajectController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");

const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
	filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

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
