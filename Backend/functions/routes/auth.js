const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate, authorizeRoles } = require("../Middleware/authMiddleware");
const { auth: adminAuth, getDb } = require("../firebase");

const devBypassAdminUserCreation =
	(process.env.ALLOW_DEV_ACCOUNT_CREATION || "false").toLowerCase() === "true";

// Middleware: allow bootstrap (first admin) without auth, else require admin
async function allowBootstrapOrRequireAdmin(req, res, next) {
	try {
		if (devBypassAdminUserCreation) {
			return next();
		}
		const snap = await getDb().collection("users").where("role", "==", "admin").limit(1).get();
		if (snap.empty) {
			// No admin exists yet: allow unauthenticated bootstrap creation
			return next();
		}
		// Admin exists: enforce authentication and admin role
		return authenticate(req, res, () => authorizeRoles("admin")(req, res, next));
	} catch (e) {
		return res.status(500).json({ error: e.message || "Auth bootstrap check failed" });
	}
}

router.post("/login/firebase", authController.firebaseLogin);
// Registration endpoints for client
router.post("/register/firebase", authController.firebaseRegister);
// Optional: legacy password-based registration (not recommended)
router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);
router.post("/track-login", authenticate, authController.trackLogin);

// Admin-managed accounts
router.post("/admin/users", allowBootstrapOrRequireAdmin, authController.adminCreateUser);

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

// Delete any user (including admins) — admin only
router.delete(
	"/admin/users/:uid",
	authenticate,
	authorizeRoles("admin"),
	authController.adminDeleteUser
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
