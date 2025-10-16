const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "supersecret"; // move to .env

// Protect route
exports.authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token format" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    // JWT payload now uses { uid, role, ... }
    req.user = decoded || {};
    if (req.user && req.user.uid && !req.user.firebaseUid) {
      req.user.firebaseUid = req.user.uid;
    }
    // Back-compat: some legacy code referenced req.user.id (SQL id). Alias it to uid if missing.
    if (req.user && !req.user.id && req.user.uid) {
      req.user.id = req.user.uid;
    }
    next();
  });
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
