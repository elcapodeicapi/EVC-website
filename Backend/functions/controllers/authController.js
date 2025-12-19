const admin = require("firebase-admin");
const { getDb, getAuth } = require("../firebase");

const MANAGED_ROLES = new Set(["admin", "coach", "customer", "user", "kwaliteitscoordinator", "assessor"]);

const IMPERSONATION_ALLOWED_ROLES = new Set(["customer", "user", "coach", "kwaliteitscoordinator", "assessor"]);

const roleRedirectMap = {
  admin: "/admin",
  coach: "/coach",
  customer: "/customer",
  user: "/customer",
  kwaliteitscoordinator: "/kwaliteitscoordinator",
  assessor: "/assessor",
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
  // Use server timestamp when available; fall back to Timestamp.now() or Date to avoid crashes in environments
  // where FieldValue may be undefined due to SDK/runtime differences.
  const serverTsFn = admin?.firestore?.FieldValue?.serverTimestamp;
  const timestampNow = admin?.firestore?.Timestamp?.now;
  const lastLoggedIn = typeof serverTsFn === "function"
    ? serverTsFn()
    : (typeof timestampNow === "function" ? timestampNow() : new Date());
  const payload = { lastLoggedIn };
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined) {
      payload[key] = value;
    }
  });
  const userRef = getDb().collection("users").doc(uid);
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
  const userRecord = await getAuth().createUser({ email, password, displayName: name });
	await getDb().collection("users").doc(userRecord.uid).set({
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
  const snap = await getDb().collection("users").doc(uid).get();
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

  const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    // Load profile from Firestore (role/name)
  const snap = await getDb().collection("users").doc(uid).get();
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
  const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    // Write/merge profile to Firestore
  await getDb().collection("users").doc(uid).set(
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
  const { email, password, role = "customer", name = "", trajectId = null, startDate, endDate } = req.body;
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

    // If creating a candidate, require valid start/end dates
    const isCandidate = normalizedRole === "customer" || normalizedRole === "user";
    const normalizeYMD = (value) => {
      if (value == null || value === "") return null;
      const s = String(value).trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    };
    let startYmd = null;
    let endYmd = null;
    if (isCandidate) {
      startYmd = normalizeYMD(startDate);
      endYmd = normalizeYMD(endDate);
      if (!startYmd || !endYmd) {
        return res.status(400).json({ error: "startDate en endDate zijn verplicht in formaat YYYY-MM-DD" });
      }
      const start = new Date(`${startYmd}T00:00:00.000Z`);
      const end = new Date(`${endYmd}T00:00:00.000Z`);
      if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime())) {
        return res.status(400).json({ error: "startDate en endDate ongeldig" });
      }
      if (end.getTime() <= start.getTime()) {
        return res.status(400).json({ error: "Einddatum moet later zijn dan startdatum" });
      }
    }

    // Prevent duplicates (Firestore)
  const existingSnap = await getDb().collection("users").where("email", "==", email).limit(1).get();
    if (!existingSnap.empty) return res.status(409).json({ error: "User already exists" });

  const userRecord = await getAuth().createUser({
      email,
      password,
      displayName: name,
    });

  const db = getDb();
  const userRef = db.collection("users").doc(userRecord.uid);
  const baseUserPayload = {
      name,
      email,
      role: normalizedRole,
      createdAt: new Date(),
      trajectId: normalizedRole === "customer" ? trajectId : null,
      createdByAdminId: req.user?.uid ?? null,
    };

    // Apply candidate-specific fields
    if (isCandidate) {
      const start = new Date(`${startYmd}T00:00:00.000Z`);
      const end = new Date(`${endYmd}T00:00:00.000Z`);
      const TS = admin.firestore.Timestamp;
      baseUserPayload.evcStartDate = TS.fromDate(start);
      baseUserPayload.evcEndDate = TS.fromDate(end);
    }

    await userRef.set(baseUserPayload, { merge: true });

    // Mirror dates into profile details for trajectory page parity
    if (isCandidate) {
      const detailsRef = userRef.collection("profile").doc("details");
      const detailsPayload = {
        updatedAt: new Date(),
        evcTrajectory: {
          startDate: startYmd,
          endDate: endYmd,
        },
      };
      await detailsRef.set(detailsPayload, { merge: true });
    }

    // Create initial assignment to unlock collecting-phase permissions
    if (isCandidate) {
      const assignmentsRef = db.collection("assignments").doc(userRecord.uid);
      const now = new Date();
      const status = "Bewijzen verzamelen"; // DEFAULT_TRAJECT_STATUS
      await assignmentsRef.set(
        {
          customerId: userRecord.uid,
          status,
          createdAt: now,
          updatedAt: now,
          statusUpdatedAt: now,
          statusUpdatedBy: req.user?.uid || null,
          statusUpdatedByRole: "admin",
          // Mirror EVC traject dates for reference
          evcStartDate: admin.firestore.Timestamp.fromDate(new Date(`${startYmd}T00:00:00.000Z`)),
          evcEndDate: admin.firestore.Timestamp.fromDate(new Date(`${endYmd}T00:00:00.000Z`)),
          statusHistory: [
            {
              status,
              changedAt: admin.firestore.Timestamp.now(),
              changedBy: req.user?.uid || null,
              changedByRole: "admin",
            },
          ],
        },
        { merge: true }
      );
    }

    // Send welcome email using the admin-provided password (do not generate/overwrite).
    let welcomeEmail = { sent: false, provider: null, error: null };
    try {
      const module = await import("../email/sendWelcomeEmail.mjs");
      const result = await module.sendWelcomeEmailDirect({
        uid: userRecord.uid,
        email,
        name,
        password,
      });
      welcomeEmail = { sent: true, provider: result?.provider || null, error: null };
    } catch (emailErr) {
      console.error("[adminCreateUser] Welcome email failed", {
        uid: userRecord.uid,
        email,
        error: emailErr?.message || emailErr,
      });
      welcomeEmail = { sent: false, provider: null, error: emailErr?.message || String(emailErr) };
    }

    return res.status(201).json({
      message: welcomeEmail.sent
        ? "User account created"
        : "User account created, but welcome email failed",
      welcomeEmail,
      user: {
        email,
        role: normalizedRole,
        name,
        trajectId: normalizedRole === "customer" ? trajectId : null,
        firebaseUid: userRecord.uid,
        evcStartDate: isCandidate ? startYmd : null,
        evcEndDate: isCandidate ? endYmd : null,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// GET /auth/admin/users
exports.adminListUsers = async (_req, res) => {
  try {
  const snap = await getDb().collection("users").orderBy("createdAt", "desc").get();
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

  const snap = await getDb().collection("users").doc(firebaseUid).get();
    if (!snap.exists) return res.status(404).json({ error: "Target user not found" });
    const data = snap.data() || {};
    const normalizedRole = String(data.role || "").toLowerCase();
    if (!MANAGED_ROLES.has(normalizedRole)) return res.status(400).json({ error: "Target user has unsupported role" });
    if (!IMPERSONATION_ALLOWED_ROLES.has(normalizedRole)) {
      return res.status(403).json({ error: "Impersonatie voor deze rol is niet toegestaan" });
    }

    const adminUid = req.user?.uid || req.user?.firebaseUid;
    if (!adminUid) return res.status(401).json({ error: "Not authenticated" });

    // Create custom tokens for both admin (to switch back) and the target customer
  const impersonationCustomToken = await getAuth().createCustomToken(firebaseUid, {
      impersonatedBy: adminUid,
      role: normalizedRole,
    });
  const adminCustomToken = await getAuth().createCustomToken(adminUid, { role: "admin" });

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

// DELETE /auth/admin/users/:uid
exports.adminDeleteUser = async (req, res) => {
  try {
    const { uid } = req.params || {};
    if (!uid) return res.status(400).json({ error: "uid is required" });

    const db = getDb();
    const auth = getAuth();

    // Load user profile (to decide on related cleanup)
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const role = String(userData.role || "").toLowerCase();

    // Clean Firestore profile data first
    // 1) Remove profile subdocuments under users/{uid}/profile/*
    const profileDetailsRef = userRef.collection("profile").doc("details");
    const profileQuestionnaireRef = userRef.collection("profile").doc("questionnaire");
    await Promise.allSettled([
      profileDetailsRef.delete(),
      profileQuestionnaireRef.delete(),
    ]);

    // 2) Remove resume/profile doc in top-level 'profiles' collection if present
    await db.collection("profiles").doc(uid).delete().catch(() => {});

    // 3) Remove assignment for customers (best-effort)
    if (role === "customer" || role === "user") {
      const assignmentRef = db.collection("assignments").doc(uid);
      const assignmentSnap = await assignmentRef.get().catch(() => null);
      if (assignmentSnap && assignmentSnap.exists) {
        const assignment = assignmentSnap.data() || {};
        const coachId = assignment.coachId || null;
        await assignmentRef.delete().catch(() => {});
        if (coachId) {
          await db
            .collection("assignmentsByCoach")
            .doc(coachId)
            .collection("customers")
            .doc(uid)
            .delete()
            .catch(() => {});
        }
      }
    }

    // 4) Finally remove the main user profile document
    await userRef.delete().catch(() => {});

    // Delete Firebase Authentication account (ignore if already absent)
    try {
      await auth.deleteUser(uid);
    } catch (e) {
      // If user doesn't exist in Auth, continue
      const code = String(e?.errorInfo?.code || e?.code || "").toLowerCase();
      if (!code.includes("not-found")) {
        throw e;
      }
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to delete user" });
  }
};

// PUT /auth/admin/users/:uid/email
// Body: { email: string }
// Updates the user's email in Firebase Auth and Firestore atomically with rollback on failure
exports.adminUpdateUserEmail = async (req, res) => {
  try {
    const { uid } = req.params || {};
    const { email: newEmailRaw } = req.body || {};
    if (!uid) return res.status(400).json({ error: "uid is required" });
    const newEmail = (newEmailRaw || "").toString().trim();
    if (!newEmail) return res.status(400).json({ error: "email is required" });

    const db = getDb();
    const auth = getAuth();
    const userRef = db.collection("users").doc(uid);

    // Load current email (prefer Auth for source of truth)
    let oldEmail = null;
    try {
      const userRecord = await auth.getUser(uid);
      oldEmail = userRecord?.email || null;
    } catch (_) {
      // If user doesn't exist in Auth, we'll rely on Firestore
      const snap = await userRef.get();
      oldEmail = snap.exists ? (snap.data()?.email || null) : null;
    }

    if (oldEmail && oldEmail.toLowerCase() === newEmail.toLowerCase()) {
      // No change necessary
      return res.json({ uid, email: oldEmail, unchanged: true });
    }

    // Prevent duplicate email in Firestore index (best-effort check)
    const dupSnap = await db.collection("users").where("email", "==", newEmail).limit(1).get();
    if (!dupSnap.empty) {
      const doc = dupSnap.docs[0];
      if (doc.id !== uid) {
        return res.status(409).json({ error: "Email is al in gebruik" });
      }
    }

    // Try updating Auth first
    await auth.updateUser(uid, { email: newEmail });

    // Then update Firestore. If this fails, rollback Auth.
    try {
      const serverTsFn = admin?.firestore?.FieldValue?.serverTimestamp;
      const updatedAt = typeof serverTsFn === "function" ? serverTsFn() : new Date();
      await userRef.set({ email: newEmail, updatedAt }, { merge: true });
    } catch (firestoreErr) {
      // Roll back Auth change to previous email if we had one
      if (oldEmail) {
        try {
          await auth.updateUser(uid, { email: oldEmail });
        } catch (rollbackErr) {
          // Best-effort rollback failed; log for diagnostics (avoid throwing to not mask original error)
          console.error("Email rollback failed for uid", uid, rollbackErr);
        }
      }
      return res.status(500).json({ error: firestoreErr?.message || "Kon Firestore e-mail niet bijwerken" });
    }

    return res.json({ uid, email: newEmail });
  } catch (err) {
    return res.status(400).json({ error: err.message || "E-mail bijwerken mislukt" });
  }
};