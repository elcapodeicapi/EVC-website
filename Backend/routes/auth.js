const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../Middleware/authMiddleware");
const { auth: adminAuth } = require("../firebase");


// router.post("/register", authController.register);
router.post("/register/firebase", authController.firebaseRegister);
// router.post("/login", authController.login);
router.post("/login/firebase", authController.firebaseLogin);
router.get("/me", authenticate, authController.me);

// Optional: quick health route to list providers (useful when testing emulators)
router.get("/providers", async (req, res) => {
	try {
		const config = await adminAuth.getProjectConfig();
		res.json({ emulators: {
			auth: process.env.FIREBASE_AUTH_EMULATOR_HOST || null,
			firestore: process.env.FIRESTORE_EMULATOR_HOST || null,
		}, config });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});
module.exports = router;
