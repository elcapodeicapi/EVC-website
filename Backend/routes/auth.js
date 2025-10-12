const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");
const { auth: adminAuth } = require("../firebase");

router.post("/login/firebase", authController.firebaseLogin);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);

// Admin-managed accounts
router.post(
	"/admin/users",
	// authenticate,
	// authorizeRoles("admin"),
	// ⚠️ Temporary: open access during testing to allow creating bootstrap admin accounts.
	authController.adminCreateUser
);

router.get(
	"/admin/users",
	authenticate,
	authorizeRoles("admin"),
	authController.adminListUsers
);

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
