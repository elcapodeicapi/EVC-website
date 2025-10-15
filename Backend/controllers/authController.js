const { User } = require("../Models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { auth: adminAuth, db: adminDb } = require("../firebase");

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

const JWT_SECRET = "supersecret"; // 🔒 move to .env later

// POST /auth/register
exports.register = async (req, res) => {
  try {
  const { email, password, role = "user", name, trajectId = null } = req.body;

    // Create user in Firebase Auth (Admin SDK)
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    // Persist profile/role in Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      name,
      email,
      role,
      createdAt: new Date(),
      trajectId: trajectId || null,
    });

    // Optionally mirror to local SQL users table for legacy features
    let sqlUser = await User.findOne({ where: { email } });
    if (!sqlUser) {
      sqlUser = await User.create({ email, password, role, name, firebaseUid: userRecord.uid, trajectId });
    } else {
      await sqlUser.update({ firebaseUid: sqlUser.firebaseUid || userRecord.uid, trajectId });
    }

    // Issue JWT for your API using SQL user id (or Firebase UID if you prefer)
    const token = jwt.sign(
      { id: sqlUser.id, role: role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      message: "User registered",
      token,
      redirectPath: getRedirectPath(role),
      user: {
        id: sqlUser.id,
        email,
        role,
        name,
        trajectId: trajectId || null,
        firebaseUid: userRecord.uid,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// POST /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      redirectPath: getRedirectPath(user.role),
      user: { id: user.id, email: user.email, role: user.role, trajectId: user.trajectId || null, firebaseUid: user.firebaseUid || null },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /auth/me - get current logged in user
exports.me = async (req, res) => {
  try {
    const { User } = require("../Models");
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "email", "role", "name", "createdAt", "firebaseUid", "trajectId"]
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
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

    // Ensure SQL user exists for legacy flows
    let sqlUser = await User.findOne({ where: { email } });
    if (!sqlUser) {
      const tempPassword = crypto.randomBytes(12).toString("hex");
      sqlUser = await User.create({ email, password: tempPassword, role, name, firebaseUid: uid, trajectId });
    } else {
      const updates = {};
      if (!sqlUser.firebaseUid) updates.firebaseUid = uid;
      if (sqlUser.role !== role) updates.role = role;
      if (sqlUser.name !== name) updates.name = name;
      if (sqlUser.trajectId !== trajectId) updates.trajectId = trajectId;
      if (Object.keys(updates).length) {
        await sqlUser.update(updates);
      }
    }

    // Issue API JWT
    const token = jwt.sign(
      { id: sqlUser.id, role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      token,
      redirectPath: getRedirectPath(role),
  user: { id: sqlUser.id, email, role, name, trajectId, firebaseUid: uid },
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

    // Ensure SQL user exists
    let sqlUser = await User.findOne({ where: { email } });
    if (!sqlUser) {
      const tempPassword = crypto.randomBytes(12).toString("hex");
      sqlUser = await User.create({ email, password: tempPassword, role, name: name || decoded.name || "", firebaseUid: uid, trajectId });
    } else {
      const updates = {};
      if (!sqlUser.firebaseUid) updates.firebaseUid = uid;
      if (sqlUser.name !== (name || decoded.name || "")) updates.name = name || decoded.name || "";
      if (sqlUser.role !== role) updates.role = role;
      if (sqlUser.trajectId !== trajectId) updates.trajectId = trajectId;
      if (Object.keys(updates).length) {
        await sqlUser.update(updates);
      }
    }

    // Issue API JWT
    const token = jwt.sign(
      { id: sqlUser.id, role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      message: "Registered via Firebase",
      token,
      redirectPath: getRedirectPath(role),
  user: { id: sqlUser.id, email, role, name: sqlUser.name, trajectId: sqlUser.trajectId || trajectId, firebaseUid: uid },
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

    // Prevent duplicates
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

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
      createdByAdminId: req.user?.id ?? null,
    });

    const sqlUser = await User.create({
      email,
      password,
      role: normalizedRole,
      name,
      firebaseUid: userRecord.uid,
      trajectId: normalizedRole === "customer" ? trajectId : null,
    });

    return res.status(201).json({
      message: "User account created",
      user: {
        id: sqlUser.id,
        email,
        role: normalizedRole,
        name,
        trajectId: sqlUser.trajectId,
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
    const users = await User.findAll({
      attributes: ["id", "name", "email", "role", "trajectId", "firebaseUid", "createdAt", "updatedAt"],
      order: [["createdAt", "DESC"]],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminImpersonate = async (req, res) => {
  try {
    const { firebaseUid, userId } = req.body || {};

    if (!firebaseUid && !userId) {
      return res.status(400).json({ error: "firebaseUid or userId is required" });
    }

    let targetUser = null;
    if (firebaseUid) {
      targetUser = await User.findOne({ where: { firebaseUid } });
    }

    if (!targetUser && userId) {
      targetUser = await User.findByPk(userId);
    }

    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const normalizedRole = String(targetUser.role || "").toLowerCase();
    if (!MANAGED_ROLES.has(normalizedRole)) {
      return res.status(400).json({ error: "Target user has unsupported role" });
    }

    if (!["customer", "user"].includes(normalizedRole)) {
      return res.status(403).json({ error: "Only customer accounts can be impersonated" });
    }

    const token = jwt.sign(
      { id: targetUser.id, role: normalizedRole, impersonatedBy: req.user.id },
      JWT_SECRET,
      { expiresIn: "30m" }
    );

    return res.json({
      token,
      redirectPath: getRedirectPath(normalizedRole),
      user: {
        id: targetUser.id,
        email: targetUser.email,
        role: normalizedRole,
        name: targetUser.name,
        trajectId: targetUser.trajectId || null,
        firebaseUid: targetUser.firebaseUid || null,
        impersonatedBy: req.user.id,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};