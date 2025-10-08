const { User } = require("../Models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { auth: adminAuth, db: adminDb } = require("../firebase");

const JWT_SECRET = "supersecret"; // 🔒 move to .env later

// POST /auth/register
exports.register = async (req, res) => {
  try {
    const { email, password, role = "user", name } = req.body;

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
    });

    // Optionally mirror to local SQL users table for legacy features
    let sqlUser = await User.findOne({ where: { email } });
    if (!sqlUser) {
      sqlUser = await User.create({ email, password, role, name });
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
      user: {
        id: sqlUser.id,
        email,
        role,
        name,
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

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /auth/me - get current logged in user
exports.me = async (req, res) => {
  try {
    const { User } = require("../Models");
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "email", "role", "name", "createdAt"]
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

    // Ensure SQL user exists for legacy flows
    let sqlUser = await User.findOne({ where: { email } });
    if (!sqlUser) {
      const tempPassword = crypto.randomBytes(12).toString("hex");
      sqlUser = await User.create({ email, password: tempPassword, role, name });
    }

    // Issue API JWT
    const token = jwt.sign(
      { id: sqlUser.id, role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      token,
      user: { id: sqlUser.id, email, role, name, firebaseUid: uid },
    });
  } catch (err) {
    return res.status(401).json({ error: err.message || "Invalid token" });
  }
};

// POST /auth/register/firebase
// Body: { idToken: string, role?: string, name?: string }
exports.firebaseRegister = async (req, res) => {
  try {
    const { idToken, role = "user", name } = req.body;
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
      },
      { merge: true }
    );

    // Ensure SQL user exists
    let sqlUser = await User.findOne({ where: { email } });
    if (!sqlUser) {
      const tempPassword = crypto.randomBytes(12).toString("hex");
      sqlUser = await User.create({ email, password: tempPassword, role, name: name || decoded.name || "" });
    } else if (sqlUser.name !== (name || decoded.name || "") || sqlUser.role !== role) {
      await sqlUser.update({ name: name || decoded.name || "", role });
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
      user: { id: sqlUser.id, email, role, name: sqlUser.name, firebaseUid: uid },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};