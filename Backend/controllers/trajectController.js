const { db: adminDb } = require("../firebase");
const { User } = require("../Models");

function mapTrajectDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || "",
    description: data.description || "",
    desiredOutcome: data.desiredOutcome || "",
    subjectKnowledge: data.subjectKnowledge || "",
    behavioralComponents: data.behavioralComponents || "",
    createdAt: data.createdAt ? data.createdAt.toDate?.() ?? data.createdAt : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate?.() ?? data.updatedAt : null,
  };
}

exports.listTrajects = async (_req, res) => {
  try {
    const snapshot = await adminDb.collection("trajects").orderBy("name").get();
    const trajects = snapshot.docs.map(mapTrajectDoc);
    res.json(trajects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createTraject = async (req, res) => {
  try {
    const {
      name,
      description = "",
      desiredOutcome = "",
      subjectKnowledge = "",
      behavioralComponents = "",
      competencies = [],
    } = req.body || {};
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedDescription = typeof description === "string" ? description.trim() : "";
    const trimmedDesiredOutcome = typeof desiredOutcome === "string" ? desiredOutcome.trim() : "";
    const trimmedSubjectKnowledge = typeof subjectKnowledge === "string" ? subjectKnowledge.trim() : "";
    const trimmedBehavioralComponents = typeof behavioralComponents === "string" ? behavioralComponents.trim() : "";
    if (!trimmedName) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!trimmedDesiredOutcome || !trimmedSubjectKnowledge || !trimmedBehavioralComponents) {
      return res.status(400).json({ error: "Required traject metadata missing" });
    }

    const trajectRef = adminDb.collection("trajects").doc();
    const trajectId = trajectRef.id;
    const now = new Date();
    await trajectRef.set({
      name: trimmedName,
      description: trimmedDescription,
      desiredOutcome: trimmedDesiredOutcome,
      subjectKnowledge: trimmedSubjectKnowledge,
      behavioralComponents: trimmedBehavioralComponents,
      createdAt: now,
      updatedAt: now,
    });

    if (Array.isArray(competencies) && competencies.length > 0) {
      const batch = adminDb.batch();
      competencies.forEach((competency, index) => {
        const { code = "", title = "", body = "", tasks = [] } = competency || {};
        const competencyRef = adminDb.collection("competencies").doc();
        batch.set(competencyRef, {
          trajectId,
          code: code || title || `COMP-${index + 1}`,
          title: title || code || `Competentie ${index + 1}`,
          description: body || "",
          tasks: Array.isArray(tasks) ? tasks : [],
          order: index,
          createdAt: now,
          updatedAt: now,
        });
      });
      await batch.commit();
    }

    const trajectDoc = await trajectRef.get();
    res.status(201).json(mapTrajectDoc(trajectDoc));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCustomerPlanning = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let trajectId = user.trajectId || null;
    let firebaseUid = user.firebaseUid || null;

    if (!firebaseUid) {
      return res.status(400).json({ error: "Account is missing Firebase linkage" });
    }

    if (!trajectId) {
      const snap = await adminDb.collection("users").doc(firebaseUid).get();
      if (snap.exists) {
        const data = snap.data();
        trajectId = data?.trajectId || null;
        if (trajectId && user.trajectId !== trajectId) {
          await user.update({ trajectId });
        }
      }
    }

    if (!trajectId) {
      return res.status(404).json({ error: "No traject assigned" });
    }

    const trajectSnap = await adminDb.collection("trajects").doc(trajectId).get();
    if (!trajectSnap.exists) {
      return res.status(404).json({ error: "Traject not found" });
    }

    const traject = mapTrajectDoc(trajectSnap);

    const competenciesSnap = await adminDb
      .collection("competencies")
      .where("trajectId", "==", trajectId)
      .get();

    const evidenceSnap = await adminDb
      .collection("evidences")
      .where("userId", "==", firebaseUid)
      .where("trajectId", "==", trajectId)
      .get();

    const evidencesByCompetency = new Map();
    evidenceSnap.docs.forEach((doc) => {
      const data = doc.data();
      const competencyId = data.competencyId || null;
      if (!competencyId) return;
      if (!evidencesByCompetency.has(competencyId)) {
        evidencesByCompetency.set(competencyId, []);
      }
      evidencesByCompetency.get(competencyId).push({
        id: doc.id,
        name: data.name || data.fileName || "",
        filePath: data.filePath || data.url || "",
        createdAt: data.createdAt ? data.createdAt.toDate?.() ?? data.createdAt : null,
      });
    });

    const competencies = competenciesSnap.docs.map((doc) => {
      const data = doc.data();
      const id = doc.id;
      return {
        id,
        code: data.code || "",
        title: data.title || "",
        description: data.description || "",
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        order: data.order ?? 0,
        uploads: evidencesByCompetency.get(id) || [],
      };
    });

    competencies.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title);
    });

    res.json({
      traject,
      competencies,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
