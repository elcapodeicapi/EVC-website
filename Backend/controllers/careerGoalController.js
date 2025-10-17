const { db } = require("../firebase");

const COLLECTION = "careerGoals";
const MAX_LENGTH = 10000;

function serialize(doc = {}) {
  return {
    content: typeof doc.content === "string" ? doc.content : "",
    updatedAt: doc.updatedAt || null,
    updatedBy: doc.updatedBy || null,
    updatedByRole: doc.updatedByRole || null,
    impersonatedBy: doc.impersonatedBy || null,
  };
}

exports.getCareerGoal = async (req, res) => {
  try {
    const uid = req.user?.firebaseUid || req.user?.uid;
    if (!uid) {
      return res.status(400).json({ error: "Missing Firebase user id" });
    }

    const snap = await db.collection(COLLECTION).doc(uid).get();
    const data = snap.exists ? snap.data() : {};
    return res.json(serialize(data));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load career goal" });
  }
};

exports.updateCareerGoal = async (req, res) => {
  try {
    const uid = req.user?.firebaseUid || req.user?.uid;
    if (!uid) {
      return res.status(400).json({ error: "Missing Firebase user id" });
    }

    const rawContent = typeof req.body?.content === "string" ? req.body.content : "";
    if (rawContent.length > MAX_LENGTH) {
      return res.status(400).json({ error: `Loopbaandoel is te lang (maximaal ${MAX_LENGTH} tekens).` });
    }

    const now = new Date().toISOString();
    const payload = {
      content: rawContent,
      updatedAt: now,
      updatedBy: uid,
      updatedByRole: req.user?.role || null,
      impersonatedBy: req.user?.impersonatedBy || null,
    };

    await db.collection(COLLECTION).doc(uid).set(payload, { merge: true });
    return res.json(serialize(payload));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to update career goal" });
  }
};
