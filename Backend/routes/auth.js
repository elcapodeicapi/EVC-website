const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");
const { auth: adminAuth } = require("../firebase");

const devBypassAdminUserCreation =
  (process.env.ALLOW_DEV_ACCOUNT_CREATION || "false").toLowerCase() === "true";

if (devBypassAdminUserCreation) {
  // eslint-disable-next-line no-console
  console.warn("⚠️  Dev mode: /auth/admin/users does not require authentication.");
}

router.post("/login/firebase", authController.firebaseLogin);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);

// Admin-managed accounts
router.post(
	"/admin/users",
	...(devBypassAdminUserCreation ? [] : [authenticate, authorizeRoles("admin")]),
	authController.adminCreateUser
);

router.get(
	"/admin/users",
	authenticate,
	authorizeRoles("admin"),
	authController.adminListUsers
);

router.post(
	"/admin/impersonate",
	authenticate,
	authorizeRoles("admin"),
	authController.adminImpersonate
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
