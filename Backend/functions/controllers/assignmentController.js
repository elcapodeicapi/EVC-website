const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getDb } = require("../firebase");
const {
  DEFAULT_TRAJECT_STATUS,
  TRAJECT_STATUS,
  normalizeTrajectStatus,
  getNextTrajectStatus,
  getPreviousTrajectStatus,
  canTransitionStatus,
} = require("../utils/trajectStatus");

const MAX_HISTORY_ENTRIES = 50;

function getServerTimestamp() {
  if (typeof FieldValue?.serverTimestamp === "function") {
    return FieldValue.serverTimestamp();
  }
  return Timestamp.now();
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizeRole(role) {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === "user") return "customer";
  return normalized;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value.toDate === "function") {
    try {
      const converted = value.toDate();
      return Number.isNaN(converted.getTime()) ? null : converted;
    } catch (_) {
      return null;
    }
  }
  return null;
}

function normalizeChangedAtForStorage(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (typeof value.toDate === "function") {
    const date = toDate(value);
    return date ? Timestamp.fromDate(date) : null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : Timestamp.fromDate(value);
  }
  if (typeof value._seconds === "number") {
    const seconds = value._seconds;
    const nanos = typeof value._nanoseconds === "number" ? value._nanoseconds : 0;
    return new Timestamp(seconds, nanos);
  }
  if (typeof value.seconds === "number") {
    const seconds = value.seconds;
    const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return new Timestamp(seconds, nanos);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
}

function normalizeStoredHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const status = normalizeTrajectStatus(entry.status);
      if (!status) return null;
      const normalizedChangedAt = normalizeChangedAtForStorage(entry.changedAt);
      const normalized = {
        status,
        changedAt: normalizedChangedAt,
        changedBy: entry.changedBy || null,
        changedByRole: normalizeRole(entry.changedByRole) || null,
      };
      if (typeof entry.note === "string" && entry.note.trim()) {
        normalized.note = entry.note.trim();
      }
      return normalized;
    })
    .filter(Boolean);
}

function serializeHistoryForResponse(history = []) {
  return normalizeStoredHistory(history).map((entry) => {
    const changedAtDate = toDate(entry.changedAt);
    return {
      status: entry.status,
      changedAt: changedAtDate ? changedAtDate.toISOString() : null,
      changedAtMillis: changedAtDate ? changedAtDate.getTime() : null,
      changedBy: entry.changedBy || null,
      changedByRole: entry.changedByRole || null,
      note: entry.note || null,
    };
  });
}

exports.updateAssignmentStatus = async (req, res) => {
  try {
    const { customerId } = req.params || {};
    if (!customerId) {
      throw new HttpError(400, "customerId is vereist");
    }

  const { status, note = null, assessorId: assessorIdFromBody = null } = req.body || {};
    const targetStatus = normalizeTrajectStatus(status);
    if (!targetStatus) {
      throw new HttpError(400, "Ongeldige statuswaarde");
    }

    const actorId = req.user?.uid || req.user?.firebaseUid || null;
    const actorRoleRaw = req.user?.role || null;
    const actorRole = normalizeRole(actorRoleRaw);
    if (!actorRole) {
      throw new HttpError(403, "Onbekende rol");
    }

    const db = getDb();
    const assignmentRef = db.collection("assignments").doc(customerId);

    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(assignmentRef);
      const existing = snapshot.exists ? snapshot.data() || {} : {};
      const currentStatus = normalizeTrajectStatus(existing.status) || DEFAULT_TRAJECT_STATUS;

      if (currentStatus === targetStatus) {
        throw new HttpError(409, "Status is al ingesteld");
      }

      if (!canTransitionStatus({ fromStatus: currentStatus, toStatus: targetStatus, actorRole })) {
        throw new HttpError(403, "Je hebt geen rechten om deze status te wijzigen");
      }

  const now = getServerTimestamp();
  const historyTimestamp = Timestamp.now();
      const historyEntry = {
        status: targetStatus,
        changedAt: historyTimestamp,
        changedBy: actorId || null,
        changedByRole: actorRole,
      };
      if (note && typeof note === "string" && note.trim()) {
        historyEntry.note = note.trim();
      }

      const normalizedHistory = normalizeStoredHistory(existing.statusHistory);
      const trimmedHistory = normalizedHistory.slice(-MAX_HISTORY_ENTRIES + 1);
      const storedHistory = [...trimmedHistory, historyEntry];

      const payload = {
        customerId,
        status: targetStatus,
        statusUpdatedAt: now,
        statusUpdatedBy: actorId || null,
        statusUpdatedByRole: actorRole,
        updatedAt: now,
        statusHistory: storedHistory,
      };

      if (!existing.createdAt) {
        payload.createdAt = now;
      }

      // Pre-read any additional docs needed BEFORE any writes
      let coordinatorId = null;
      if (actorRole === "coach" && targetStatus === TRAJECT_STATUS.QUALITY) {
        const coordinatorsQuery = db.collection("users").where("role", "==", "kwaliteitscoordinator").limit(1);
        const coordSnap = await tx.get(coordinatorsQuery);
        const coordinatorDoc = coordSnap.docs[0];
        coordinatorId = coordinatorDoc ? coordinatorDoc.id : null;
        if (!coordinatorId) {
          throw new HttpError(400, "Geen kwaliteitscoördinator gevonden");
        }
      }

      let validatedAssessorId = null;
      if (actorRole === "kwaliteitscoordinator" && targetStatus === TRAJECT_STATUS.ASSESSMENT) {
        const assessorId = typeof assessorIdFromBody === "string" ? assessorIdFromBody : null;
        if (!assessorId) {
          throw new HttpError(400, "assessorId is vereist voor doorsturen naar assessor");
        }
        const assessorRef = db.collection("users").doc(assessorId);
        const assessorSnap = await tx.get(assessorRef);
        if (!assessorSnap.exists || (assessorSnap.data()?.role || "").toLowerCase() !== "assessor") {
          throw new HttpError(400, "Ongeldige assessorId");
        }
        validatedAssessorId = assessorId;
      }

      // Now perform all writes
      const coachId = existing.coachId || (typeof req.body?.coachId === "string" ? req.body.coachId : null) || null;
      if (coachId) {
        payload.coachId = coachId;
        const coachAssignmentRef = db.collection("assignmentsByCoach").doc(coachId).collection("customers").doc(customerId);
        tx.set(
          coachAssignmentRef,
          {
            customerId,
            coachId,
            status: targetStatus,
            statusUpdatedAt: now,
            statusUpdatedBy: actorId || null,
            statusUpdatedByRole: actorRole,
            updatedAt: now,
            statusHistory: storedHistory,
          },
          { merge: true }
        );
      }

      if (coordinatorId) {
        payload.kwaliteitscoordinatorId = coordinatorId;
        const userRef = db.collection("users").doc(customerId);
        tx.set(
          userRef,
          { kwaliteitscoordinatorId: coordinatorId, kwaliteitscoordinatorLinkedAt: now },
          { merge: true }
        );
        const coordAssignmentRef = db.collection("assignmentsByCoordinator").doc(coordinatorId).collection("customers").doc(customerId);
        tx.set(
          coordAssignmentRef,
          {
            customerId,
            kwaliteitscoordinatorId: coordinatorId,
            status: targetStatus,
            statusUpdatedAt: now,
            statusUpdatedBy: actorId || null,
            statusUpdatedByRole: actorRole,
            updatedAt: now,
            statusHistory: storedHistory,
          },
          { merge: true }
        );
      }

      if (validatedAssessorId) {
        payload.assessorId = validatedAssessorId;
        const userRef = db.collection("users").doc(customerId);
        tx.set(userRef, { assessorId: validatedAssessorId, assessorLinkedAt: now }, { merge: true });
        const assessorAssignmentRef = db.collection("assignmentsByAssessor").doc(validatedAssessorId).collection("customers").doc(customerId);
        tx.set(
          assessorAssignmentRef,
          {
            customerId,
            assessorId: validatedAssessorId,
            status: targetStatus,
            statusUpdatedAt: now,
            statusUpdatedBy: actorId || null,
            statusUpdatedByRole: actorRole,
            updatedAt: now,
            statusHistory: storedHistory,
          },
          { merge: true }
        );
      }

      tx.set(assignmentRef, payload, { merge: true });
    });

    const finalSnap = await assignmentRef.get();
    const finalData = finalSnap.exists ? finalSnap.data() || {} : {};

    const responsePayload = {
      id: finalSnap.id,
      customerId,
      coachId: finalData.coachId || null,
      status: normalizeTrajectStatus(finalData.status) || TRAJECT_STATUS.COLLECTING,
      statusUpdatedAt: toDate(finalData.statusUpdatedAt)?.toISOString() || null,
      statusUpdatedBy: finalData.statusUpdatedBy || null,
      statusUpdatedByRole: normalizeRole(finalData.statusUpdatedByRole) || null,
      statusHistory: serializeHistoryForResponse(finalData.statusHistory),
      previousStatus: getPreviousTrajectStatus(finalData.status),
      nextStatus: getNextTrajectStatus(finalData.status),
      kwaliteitscoordinatorId: finalData.kwaliteitscoordinatorId || null,
      assessorId: finalData.assessorId || null,
    };

    return res.json(responsePayload);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Onbekende fout" });
  }
};
