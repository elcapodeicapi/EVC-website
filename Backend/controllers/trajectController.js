const { db: adminDb } = require("../firebase");

function mapTrajectDoc(doc) {
  const data = doc.data();
  const groups = Array.isArray(data.competencyGroups) ? data.competencyGroups : [];
  const computedCompetencyCount = Number.isInteger(data.competencyCount)
    ? data.competencyCount
    : groups.reduce((total, group) => total + (group?.competencyCount ?? 0), 0);
  return {
    id: doc.id,
    name: data.name || "",
    description: data.description || "",
    competencyGroups: groups.map((group, index) => ({
      code: group?.code || "",
      title: group?.title || "",
      competencyCount: group?.competencyCount ?? 0,
      order: group?.order ?? index,
    })),
    competencyCount: computedCompetencyCount,
    createdAt: data.createdAt ? data.createdAt.toDate?.() ?? data.createdAt : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate?.() ?? data.updatedAt : null,
  };
}

function normalizeTrajectPayload(body = {}) {
  const {
    name,
    description = "",
    competencyGroups = [],
    competencies = [],
  } = body;

  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedDescription = typeof description === "string" ? description.trim() : "";

  const rawGroups = Array.isArray(competencyGroups) ? competencyGroups : [];
  const baseGroups = rawGroups.length > 0
    ? rawGroups
    : (Array.isArray(competencies) ? [{ code: "DEFAULT", title: "Competenties", competencies }] : []);

  const sourceGroups = baseGroups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const orderA = typeof a.group?.order === "number" ? a.group.order : a.index;
      const orderB = typeof b.group?.order === "number" ? b.group.order : b.index;
      if (orderA === orderB) {
        return a.index - b.index;
      }
      return orderA - orderB;
    })
    .map((entry) => entry.group);

  const sanitizedGroups = [];
  const competencyDocs = [];
  let validationError = null;

  sourceGroups.forEach((group, groupIndex) => {
    if (validationError) return;

    const rawCode = typeof group?.code === "string" ? group.code.trim() : "";
    const rawTitle = typeof group?.title === "string" ? group.title.trim() : "";

    const rawCompetencies = Array.isArray(group?.competencies)
      ? [...group.competencies].sort((a, b) => (a?.order ?? a?.competencyOrder ?? 0) - (b?.order ?? b?.competencyOrder ?? 0))
      : [];

    const sanitizedCompetencies = [];

    rawCompetencies.forEach((competency, competencyIndex) => {
      if (validationError) return;

      const code = typeof competency?.code === "string" ? competency.code.trim() : "";
      const title = typeof competency?.title === "string" ? competency.title.trim() : "";
      const descriptionValue = typeof competency?.description === "string"
        ? competency.description.trim()
        : typeof competency?.body === "string"
          ? competency.body.trim()
          : "";
      const desiredOutcome = typeof competency?.desiredOutcome === "string" ? competency.desiredOutcome.trim() : "";
      const subjectKnowledge = typeof competency?.subjectKnowledge === "string" ? competency.subjectKnowledge.trim() : "";
      const behavioralComponents = typeof competency?.behavioralComponents === "string" ? competency.behavioralComponents.trim() : "";

      const hasContent = Boolean(code || title || descriptionValue || desiredOutcome || subjectKnowledge || behavioralComponents);
      if (!hasContent) {
        return;
      }

      if (!code || !title || !desiredOutcome || !subjectKnowledge || !behavioralComponents) {
        validationError = "Elke competentie moet ingevulde velden hebben.";
        return;
      }

      const competencyOrder = competencyIndex;
      const order = groupIndex * 100 + competencyOrder;

      sanitizedCompetencies.push({
        code,
        title,
        description: descriptionValue,
        desiredOutcome,
        subjectKnowledge,
        behavioralComponents,
        order,
        groupOrder: groupIndex,
        competencyOrder,
      });

      competencyDocs.push({
        code,
        title,
        description: descriptionValue,
        desiredOutcome,
        subjectKnowledge,
        behavioralComponents,
        order,
        groupCode: rawCode,
        groupTitle: rawTitle,
        groupOrder: groupIndex,
        competencyOrder,
      });
    });

    if (!rawCode || !rawTitle) {
      validationError = "Elke cluster heeft een code en naam nodig.";
      return;
    }

    if (sanitizedCompetencies.length === 0) {
      validationError = "Voeg minstens één competentie toe aan elk cluster.";
      return;
    }

    sanitizedGroups.push({
      code: rawCode,
      title: rawTitle,
      order: groupIndex,
      competencyCount: sanitizedCompetencies.length,
      competencies: sanitizedCompetencies,
    });
  });

  return {
    trimmedName,
    trimmedDescription,
    sanitizedGroups,
    competencyDocs,
    validationError,
  };
}

async function commitBatch(actions) {
  if (!actions || actions.length === 0) {
    return;
  }

  let batch = adminDb.batch();
  let counter = 0;

  for (const apply of actions) {
    apply(batch);
    counter += 1;
    if (counter >= 450) {
      await batch.commit();
      batch = adminDb.batch();
      counter = 0;
    }
  }

  if (counter > 0) {
    await batch.commit();
  }
}

async function fetchTrajectDetail(trajectId) {
  const trajectRef = adminDb.collection("trajects").doc(trajectId);
  const trajectSnap = await trajectRef.get();
  if (!trajectSnap.exists) {
    return null;
  }

  const data = trajectSnap.data();
  const summary = mapTrajectDoc(trajectSnap);
  const baseGroups = Array.isArray(data.competencyGroups) ? data.competencyGroups : [];

  const groups = baseGroups
    .map((group, index) => ({
      code: group?.code || "",
      title: group?.title || "",
      order: group?.order ?? index,
      competencyCount: group?.competencyCount ?? 0,
      competencies: [],
    }));

  const groupMap = new Map();
  groups.forEach((group, index) => {
    const key = group.code || `__${index}`;
    groupMap.set(key, group);
  });

  const competenciesSnap = await adminDb
    .collection("competencies")
    .where("trajectId", "==", trajectId)
    .get();

  competenciesSnap.docs.forEach((doc) => {
    const competency = doc.data();
    const groupKey = competency.groupCode || `__${competency.groupOrder ?? 0}`;
    const fallbackOrder = typeof competency.groupOrder === "number" ? competency.groupOrder : groups.length;

    let target = groupMap.get(groupKey);
    if (!target) {
      target = {
        code: competency.groupCode || "",
        title: competency.groupTitle || "",
        order: fallbackOrder,
        competencyCount: 0,
        competencies: [],
      };
      groups.push(target);
      groupMap.set(groupKey, target);
    }

    target.competencies.push({
      id: doc.id,
      code: competency.code || "",
      title: competency.title || "",
      description: competency.description || "",
      desiredOutcome: competency.desiredOutcome || "",
      subjectKnowledge: competency.subjectKnowledge || "",
      behavioralComponents: competency.behavioralComponents || "",
      order: competency.order ?? competency.competencyOrder ?? target.competencies.length,
    });
  });

  groups.forEach((group) => {
    group.competencies.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    group.competencyCount = group.competencies.length;
  });

  groups.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    id: summary.id,
    name: summary.name,
    description: summary.description,
    competencyGroups: groups,
    competencyCount: groups.reduce((total, group) => total + (group.competencyCount ?? 0), 0),
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
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
    const { trimmedName, trimmedDescription, sanitizedGroups, competencyDocs, validationError } = normalizeTrajectPayload(req.body || {});

    if (!trimmedName) {
      return res.status(400).json({ error: "Name is required" });
    }

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (sanitizedGroups.length === 0) {
      return res.status(400).json({ error: "Voeg minimaal één competentiecluster toe." });
    }

    const trajectRef = adminDb.collection("trajects").doc();
    const trajectId = trajectRef.id;
    const now = new Date();

    await trajectRef.set({
      name: trimmedName,
      description: trimmedDescription,
      competencyGroups: sanitizedGroups.map(({ code, title, competencyCount, order }) => ({
        code,
        title,
        competencyCount,
        order,
      })),
      competencyCount: sanitizedGroups.reduce((total, group) => total + (group.competencyCount ?? 0), 0),
      createdAt: now,
      updatedAt: now,
    });

    const createActions = competencyDocs.map((competency) => (batch) => {
      const competencyRef = adminDb.collection("competencies").doc();
      batch.set(competencyRef, {
        trajectId,
        code: competency.code,
        title: competency.title,
        description: competency.description,
        desiredOutcome: competency.desiredOutcome,
        subjectKnowledge: competency.subjectKnowledge,
        behavioralComponents: competency.behavioralComponents,
        order: competency.order,
        groupCode: competency.groupCode,
        groupTitle: competency.groupTitle,
        groupOrder: competency.groupOrder,
        competencyOrder: competency.competencyOrder,
        tasks: [],
        createdAt: now,
        updatedAt: now,
      });
    });

    await commitBatch(createActions);

    const trajectDoc = await trajectRef.get();
    res.status(201).json(mapTrajectDoc(trajectDoc));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTraject = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) {
      return res.status(400).json({ error: "Traject ID is vereist" });
    }

    const detail = await fetchTrajectDetail(id);
    if (!detail) {
      return res.status(404).json({ error: "Traject niet gevonden" });
    }

    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTraject = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) {
      return res.status(400).json({ error: "Traject ID is vereist" });
    }

    const trajectRef = adminDb.collection("trajects").doc(id);
    const existingDoc = await trajectRef.get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: "Traject niet gevonden" });
    }

    const { trimmedName, trimmedDescription, sanitizedGroups, competencyDocs, validationError } = normalizeTrajectPayload(req.body || {});

    if (!trimmedName) {
      return res.status(400).json({ error: "Name is required" });
    }

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (sanitizedGroups.length === 0) {
      return res.status(400).json({ error: "Voeg minimaal één competentiecluster toe." });
    }

    const now = new Date();

    await trajectRef.update({
      name: trimmedName,
      description: trimmedDescription,
      competencyGroups: sanitizedGroups.map(({ code, title, competencyCount, order }) => ({
        code,
        title,
        competencyCount,
        order,
      })),
      competencyCount: sanitizedGroups.reduce((total, group) => total + (group.competencyCount ?? 0), 0),
      updatedAt: now,
    });

    const existingCompetenciesSnap = await adminDb
      .collection("competencies")
      .where("trajectId", "==", id)
      .get();

    const deleteActions = existingCompetenciesSnap.docs.map((doc) => (batch) => batch.delete(doc.ref));
    await commitBatch(deleteActions);

    const createActions = competencyDocs.map((competency) => (batch) => {
      const competencyRef = adminDb.collection("competencies").doc();
      batch.set(competencyRef, {
        trajectId: id,
        code: competency.code,
        title: competency.title,
        description: competency.description,
        desiredOutcome: competency.desiredOutcome,
        subjectKnowledge: competency.subjectKnowledge,
        behavioralComponents: competency.behavioralComponents,
        order: competency.order,
        groupCode: competency.groupCode,
        groupTitle: competency.groupTitle,
        groupOrder: competency.groupOrder,
        competencyOrder: competency.competencyOrder,
        tasks: [],
        createdAt: now,
        updatedAt: now,
      });
    });

    await commitBatch(createActions);

    const detail = await fetchTrajectDetail(id);
    res.json(detail || { id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCustomerPlanning = async (req, res) => {
  try {
    const firebaseUid = req.user?.uid || req.user?.firebaseUid;
    if (!firebaseUid) return res.status(401).json({ error: "Not authenticated" });

    const userSnap = await adminDb.collection("users").doc(firebaseUid).get();
    if (!userSnap.exists) return res.status(404).json({ error: "User profile not found" });
    const userData = userSnap.data() || {};
    const trajectId = userData.trajectId || null;
    if (!trajectId) return res.status(404).json({ error: "No traject assigned" });

    const trajectSnap = await adminDb.collection("trajects").doc(trajectId).get();
    if (!trajectSnap.exists) return res.status(404).json({ error: "Traject not found" });
    const traject = mapTrajectDoc(trajectSnap);

    const competenciesSnap = await adminDb
      .collection("competencies")
      .where("trajectId", "==", trajectId)
      .get();

    // Prefer per-user uploads subcollection (new path), fall back to legacy evidences collection
    const uploadsSnap = await adminDb
      .collection("users")
      .doc(firebaseUid)
      .collection("uploads")
      .where("trajectId", "==", trajectId)
      .get();

    const evidencesByCompetency = new Map();
    uploadsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const competencyId = data.competencyId || null;
      if (!competencyId) return;
      if (!evidencesByCompetency.has(competencyId)) evidencesByCompetency.set(competencyId, []);
      evidencesByCompetency.get(competencyId).push({
        id: doc.id,
        name: data.name || data.fileName || "",
        filePath: data.filePath || data.url || "",
        createdAt: data.uploadedAt || data.createdAt || null,
      });
    });

    // Legacy evidence collection support
    if (evidencesByCompetency.size === 0) {
      const legacySnap = await adminDb
        .collection("evidences")
        .where("userId", "==", firebaseUid)
        .where("trajectId", "==", trajectId)
        .get();
      legacySnap.docs.forEach((doc) => {
        const data = doc.data();
        const competencyId = data.competencyId || null;
        if (!competencyId) return;
        if (!evidencesByCompetency.has(competencyId)) evidencesByCompetency.set(competencyId, []);
        evidencesByCompetency.get(competencyId).push({
          id: doc.id,
          name: data.name || data.fileName || "",
          filePath: data.filePath || data.url || "",
          createdAt: data.createdAt ? data.createdAt.toDate?.() ?? data.createdAt : null,
        });
      });
    }

    const competencies = competenciesSnap.docs.map((doc) => {
      const data = doc.data();
      const id = doc.id;
      return {
        id,
        code: data.code || "",
        title: data.title || "",
        description: data.description || "",
        desiredOutcome: data.desiredOutcome || "",
        subjectKnowledge: data.subjectKnowledge || "",
        behavioralComponents: data.behavioralComponents || "",
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        order: data.order ?? 0,
        groupCode: data.groupCode || "",
        groupTitle: data.groupTitle || "",
        groupOrder: data.groupOrder ?? 0,
        competencyOrder: data.competencyOrder ?? 0,
        uploads: evidencesByCompetency.get(id) || [],
      };
    });

    competencies.sort((a, b) => {
      if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
      if (a.competencyOrder !== b.competencyOrder) return a.competencyOrder - b.competencyOrder;
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title);
    });

    res.json({ traject, competencies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
