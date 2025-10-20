const admin = require("firebase-admin");
const { db: adminDb, auth: adminAuth } = require("../firebase");

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

function toDateSafe(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value.toDate === "function") {
    try {
      const result = value.toDate();
      return Number.isNaN(result.getTime()) ? null : result;
    } catch (_) {
      return null;
    }
  }
  if (typeof value._seconds === "number") {
    const millis = value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6);
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeTimestamp(value) {
  const date = toDateSafe(value);
  return date ? date.toISOString() : null;
}

async function upsertUserLoginMetadata(uid, metadata = {}) {
  if (!uid) {
    return { profile: null };
  }
  const payload = { lastLoggedIn: admin.firestore.FieldValue.serverTimestamp() };
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined) {
      payload[key] = value;
    }
  });
  const userRef = adminDb.collection("users").doc(uid);
  await userRef.set(payload, { merge: true });
  const updatedSnap = await userRef.get();
  const profile = updatedSnap.exists ? updatedSnap.data() || {} : {};
  return { profile };
}

// JWT removed: API relies solely on Firebase ID tokens for authorization

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
    return res.json({
      message: "User registered",
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
      lastLoggedIn: serializeTimestamp(data.lastLoggedIn),
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
    const profile = snap.exists ? snap.data() || {} : {};
    const role = profile.role || "user";
    const name = profile.name || decoded.name || "";
    const trajectId = profile.trajectId || null;
    const photoURL = profile.photoURL || decoded.picture || null;

    const metadata = {
      email: email || profile.email || null,
      role,
      name,
      trajectId,
    };
    if (photoURL) {
      metadata.photoURL = photoURL;
    }

    const { profile: updatedProfile } = await upsertUserLoginMetadata(uid, metadata);
    const finalProfile = { ...profile, ...updatedProfile };
    const finalRole = finalProfile.role || role || "user";
    const finalName = finalProfile.name || name || "";
    const finalTrajectId =
      finalProfile.trajectId !== undefined ? finalProfile.trajectId : trajectId !== undefined ? trajectId : null;
    const finalPhotoURL =
      finalProfile.photoURL !== undefined ? finalProfile.photoURL : photoURL !== undefined ? photoURL : null;
    const finalEmail = finalProfile.email || email || null;

    return res.json({
      redirectPath: getRedirectPath(finalRole),
      user: {
        uid,
        email: finalEmail,
        role: finalRole,
        name: finalName,
        trajectId: finalTrajectId,
        photoURL: finalPhotoURL,
        lastLoggedIn: serializeTimestamp(finalProfile.lastLoggedIn),
      },
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

    return res.json({
      message: "Registered via Firebase",
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

exports.trackLogin = async (req, res) => {
  try {
    const uid = req.user?.uid || req.user?.firebaseUid;
    if (!uid) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { profile } = await upsertUserLoginMetadata(uid);
    return res.json({ lastLoggedIn: serializeTimestamp(profile?.lastLoggedIn) });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to record login" });
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
    const users = snap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        uid: doc.id,
        ...data,
        lastLoggedIn: serializeTimestamp(data.lastLoggedIn),
      };
    });
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
    if (!["customer", "user", "coach"].includes(normalizedRole)) {
      return res.status(403).json({ error: "Only customer or coach accounts can be impersonated" });
    }

    const adminUid = req.user?.uid || req.user?.firebaseUid;
    if (!adminUid) return res.status(401).json({ error: "Not authenticated" });

    // Create custom tokens for both admin (to switch back) and the target customer
    const impersonationCustomToken = await adminAuth.createCustomToken(firebaseUid, {
      impersonatedBy: adminUid,
      role: normalizedRole,
    });
    const adminCustomToken = await adminAuth.createCustomToken(adminUid, { role: "admin" });

    return res.json({
      customerCustomToken: impersonationCustomToken,
      targetCustomToken: impersonationCustomToken,
      targetRole: normalizedRole,
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
        lastLoggedIn: serializeTimestamp(data.lastLoggedIn),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};