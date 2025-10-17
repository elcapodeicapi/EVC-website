const { db: adminDb, auth: adminAuth } = require("../firebase");
const jwt = require("jsonwebtoken");

const MANAGED_ROLES = new Set(["admin", "coach", "customer", "user"]);

const roleRedirectMap = {
  admin: "/admin",
  coach: "/coach",
  customer: "/customer",
  user: "/customer",
};

function getRedirectPath(role) {
  return roleRedirectMap[role] || "/dashboard";
}

const JWT_SECRET = process.env.JWT_SECRET || "supersecret"; // 🔒 move to .env

// POST /auth/register (password registration) — deprecated in favor of Firebase login; retained for parity
exports.register = async (req, res) => {
  try {
    const { email, password, role = "user", name, trajectId = null } = req.body;
    const userRecord = await adminAuth.createUser({ email, password, displayName: name });
  await adminDb.collection("users").doc(userRecord.uid).set({
      name,
      email,
      role,
      createdAt: new Date(),
      trajectId: trajectId || null,
    });
    // Issue JWT keyed by Firebase UID
    const token = jwt.sign({ uid: userRecord.uid, role }, JWT_SECRET, { expiresIn: "1h" });
    return res.json({
      message: "User registered",
      token,
      redirectPath: getRedirectPath(role),
      user: { uid: userRecord.uid, email, role, name, trajectId },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// POST /auth/login
exports.login = async (req, res) => {
  // Password login against SQLite removed; use /auth/login/firebase with an ID token
  return res.status(410).json({ error: "Password login disabled. Use /auth/login/firebase." });
};

// GET /auth/me - get current logged in user
exports.me = async (req, res) => {
  try {
    const uid = req.user?.uid || req.user?.firebaseUid;
    if (!uid) return res.status(401).json({ error: "Not authenticated" });
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });
    const data = snap.data() || {};
    res.json({
      uid,
      email: data.email || null,
      role: data.role || req.user?.role || "user",
      name: data.name || "",
      createdAt: data.createdAt || null,
      trajectId: data.trajectId || null,
      photoURL: data.photoURL || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /auth/login/firebase
// Body: { idToken: string }
exports.firebaseLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "Missing idToken" });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    // Load profile from Firestore (role/name)
    const snap = await adminDb.collection("users").doc(uid).get();
    const profile = snap.exists ? snap.data() : {};
    const role = profile.role || "user";
    const name = profile.name || decoded.name || "";
    const trajectId = profile.trajectId || null;
    const photoURL = profile.photoURL || decoded.picture || null;

    // Issue API JWT with Firebase uid
    const token = jwt.sign({ uid, role }, JWT_SECRET, { expiresIn: "1h" });

    return res.json({
      token,
      redirectPath: getRedirectPath(role),
      user: { uid, email, role, name, trajectId, photoURL },
    });
  } catch (err) {
    return res.status(401).json({ error: err.message || "Invalid token" });
  }
};

// POST /auth/register/firebase
// Body: { idToken: string, role?: string, name?: string }
exports.firebaseRegister = async (req, res) => {
  try {
  const { idToken, role = "user", name, trajectId = null } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "Missing idToken" });
    }
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    // Write/merge profile to Firestore
    await adminDb.collection("users").doc(uid).set(
      {
        name: name || decoded.name || "",
        email,
        role,
        createdAt: new Date(),
        trajectId: trajectId || null,
      },
      { merge: true }
    );

    // Issue API JWT with Firebase uid
    const token = jwt.sign({ uid, role }, JWT_SECRET, { expiresIn: "1h" });

    return res.json({
      message: "Registered via Firebase",
      token,
      redirectPath: getRedirectPath(role),
      user: {
        uid,
        email,
        role,
        name: name || decoded.name || "",
        trajectId,
        photoURL: decoded.picture || null,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// POST /auth/admin/users
exports.adminCreateUser = async (req, res) => {
  try {
  const { email, password, role = "customer", name = "", trajectId = null } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedRole = String(role).toLowerCase();
    if (!MANAGED_ROLES.has(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (normalizedRole === "customer" && !trajectId) {
      return res.status(400).json({ error: "trajectId is required for customer accounts" });
    }

    // Prevent duplicates (Firestore)
    const existingSnap = await adminDb.collection("users").where("email", "==", email).limit(1).get();
    if (!existingSnap.empty) return res.status(409).json({ error: "User already exists" });

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    await adminDb.collection("users").doc(userRecord.uid).set({
      name,
      email,
      role: normalizedRole,
      createdAt: new Date(),
      trajectId: normalizedRole === "customer" ? trajectId : null,
      createdByAdminId: req.user?.uid ?? null,
    });

    return res.status(201).json({
      message: "User account created",
      user: {
        email,
        role: normalizedRole,
        name,
        trajectId: normalizedRole === "customer" ? trajectId : null,
        firebaseUid: userRecord.uid,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// GET /auth/admin/users
exports.adminListUsers = async (_req, res) => {
  try {
    const snap = await adminDb.collection("users").orderBy("createdAt", "desc").get();
    const users = snap.docs.map((doc) => ({ id: doc.id, uid: doc.id, ...doc.data() }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminImpersonate = async (req, res) => {
  try {
    const { firebaseUid } = req.body || {};
    if (!firebaseUid) return res.status(400).json({ error: "firebaseUid is required" });

    const snap = await adminDb.collection("users").doc(firebaseUid).get();
    if (!snap.exists) return res.status(404).json({ error: "Target user not found" });
    const data = snap.data() || {};
    const normalizedRole = String(data.role || "").toLowerCase();
    if (!MANAGED_ROLES.has(normalizedRole)) return res.status(400).json({ error: "Target user has unsupported role" });
    if (!["customer", "user"].includes(normalizedRole)) return res.status(403).json({ error: "Only customer accounts can be impersonated" });

    const adminUid = req.user?.uid || req.user?.firebaseUid;
    if (!adminUid) return res.status(401).json({ error: "Not authenticated" });

    // Create custom tokens for both admin (to switch back) and the target customer
    const customerCustomToken = await adminAuth.createCustomToken(firebaseUid, {
      impersonatedBy: adminUid,
      role: normalizedRole,
    });
    const adminCustomToken = await adminAuth.createCustomToken(adminUid, { role: "admin" });

    return res.json({
      customerCustomToken,
      adminCustomToken,
      redirectPath: getRedirectPath(normalizedRole),
      user: {
        uid: firebaseUid,
        email: data.email,
        role: normalizedRole,
        name: data.name || "",
        trajectId: data.trajectId || null,
        firebaseUid,
        impersonatedBy: adminUid,
        photoURL: data.photoURL || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};