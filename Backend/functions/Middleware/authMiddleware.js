const { auth: adminAuth, db: adminDb } = require("../firebase");

// Protect route
exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Invalid token format" });

    // Verify Firebase ID token (auto refreshed by client)
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    let role = null;
    try {
      const snap = await adminDb.collection("users").doc(uid).get();
      role = (snap.exists ? (snap.data() || {}).role : null) || null;
    } catch (_) {
      // ignore profile load errors; role remains null
    }
    req.user = { uid, firebaseUid: uid, id: uid, role: role || null };
    return next();
  } catch (e) {
    return res.status(500).json({ error: e.message || "Auth error" });
  }
};

// Allow only specific roles (admin is always allowed)
exports.authorizeRoles = (...allowedRoles) => {
  const normalized = allowedRoles.map((role) => role.toLowerCase());
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const currentRole = String(req.user.role).toLowerCase();
    if (currentRole === "admin") return next();
    if (normalized.length === 0 || normalized.includes(currentRole)) {
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  };
};

// Backwards compatibility helper
exports.requireAdmin = exports.authorizeRoles("admin");
