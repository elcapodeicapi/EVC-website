import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { DEFAULT_TRAJECT_STATUS, normalizeTrajectStatus } from "./trajectStatus";

const STATUS_HISTORY_LIMIT = 50;

function normalizeTimestamp(value) {
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
  const converted = new Date(value);
  return Number.isNaN(converted.getTime()) ? null : converted;
}

function normalizeStatusHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const status = normalizeTrajectStatus(entry.status);
      if (!status) return null;
      const changedAt = normalizeTimestamp(entry.changedAt);
      const note = typeof entry.note === "string" && entry.note.trim() ? entry.note.trim() : null;
      return {
        status,
        changedAt,
        changedAtMillis: changedAt instanceof Date ? changedAt.getTime() : null,
        changedBy: entry.changedBy || null,
        changedByRole: entry.changedByRole || null,
        note,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const timeA = a.changedAtMillis || 0;
      const timeB = b.changedAtMillis || 0;
      return timeA - timeB;
    });
}

function coerceTimestampForStorage(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
    } catch (_) {
      return null;
    }
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : Timestamp.fromDate(value);
  }
  if (typeof value.seconds === "number") {
    return new Timestamp(value.seconds, value.nanoseconds ?? 0);
  }
  if (typeof value._seconds === "number") {
    return new Timestamp(value._seconds, value._nanoseconds ? Math.floor(value._nanoseconds) : 0);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
}

function sanitizeHistoryForStorage(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const status = normalizeTrajectStatus(entry.status);
      if (!status) return null;
      const changedAt = coerceTimestampForStorage(entry.changedAt);
      const note = typeof entry.note === "string" && entry.note.trim() ? entry.note.trim() : null;
      return {
        status,
        changedAt: changedAt || null,
        changedBy: entry.changedBy || null,
        changedByRole: entry.changedByRole || null,
        note,
      };
    })
    .filter(Boolean);
}

function mapDoc(snapshot) {
  if (!snapshot) return null;
  const exists = typeof snapshot.exists === "boolean" ? snapshot.exists : true;
  if (!exists) return null;

  const rawData = typeof snapshot.data === "function" ? snapshot.data() : snapshot;
  if (!rawData || typeof rawData !== "object") return null;

  const id = snapshot.id ?? rawData.id ?? null;
  if (!id) return null;

  const normalized = { ...rawData, id };
  if (!normalized.uid) normalized.uid = id;
  if (!normalized.firebaseUid) normalized.firebaseUid = id;

  if (Array.isArray(normalized.statusHistory)) {
    normalized.statusHistory = normalizeStatusHistory(normalized.statusHistory);
  }

  Object.entries(normalized).forEach(([key, value]) => {
    if (key === "statusHistory") return;
    if (!value) return;
    if (value instanceof Timestamp || typeof value.toDate === "function" || value instanceof Date) {
      normalized[key] = normalizeTimestamp(value);
      return;
    }
    if (value && typeof value === "object") {
      if (typeof value.seconds === "number" || typeof value._seconds === "number") {
        normalized[key] = normalizeTimestamp(value);
      }
    }
  });

  return normalized;
}

function makeQueryConstraints(roles) {
  const constraints = [];
  if (Array.isArray(roles) && roles.length > 0) {
    const normalized = roles
      .map((role) => (typeof role === "string" ? role.trim().toLowerCase() : ""))
      .filter(Boolean);
    if (normalized.length === 1) {
      constraints.push(where("role", "==", normalized[0]));
    } else if (normalized.length > 1) {
      constraints.push(where("role", "in", normalized.slice(0, 10)));
    }
  }
  return constraints;
}

export function subscribeUsers(observer, options = {}) {
  const { roles } = options;
  const usersRef = collection(db, "users");
  const q = query(usersRef, ...makeQueryConstraints(roles));

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs
        .map(mapDoc)
        .filter(Boolean)
        .sort((a, b) => {
          const aName = (a.name || "").toLowerCase();
          const bName = (b.name || "").toLowerCase();
          return aName.localeCompare(bName);
        });
      observer({ data: records, error: null });
    },
    (error) => observer({ data: null, error })
  );
}

export async function fetchUsersByRole(role) {
  const { data, error } = await new Promise((resolve) => {
    const unsubscribe = subscribeUsers((payload) => {
      resolve(payload);
      unsubscribe();
    }, { roles: [role] });
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export function subscribeAssignments(observer) {
  const assignmentsRef = collection(db, "assignments");
  const q = query(assignmentsRef, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const status = normalizeTrajectStatus(data.status) || DEFAULT_TRAJECT_STATUS;
        return {
          id: docSnap.id,
          customerId: data.customerId || null,
          coachId: data.coachId || null,
          status,
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: normalizeTimestamp(data.updatedAt),
          createdBy: data.createdBy || null,
          statusUpdatedAt: normalizeTimestamp(data.statusUpdatedAt),
          statusUpdatedBy: data.statusUpdatedBy || null,
          statusUpdatedByRole: data.statusUpdatedByRole || null,
          statusHistory: normalizeStatusHistory(data.statusHistory),
        };
      });
      observer({ data: entries, error: null });
    },
    (error) => observer({ data: null, error })
  );
}

export function subscribeTrajects(observer) {
  const trajectsRef = collection(db, "trajects");
  const q = query(trajectsRef, orderBy("name"));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          if (!data) return null;
          const createdAt = data.createdAt?.toDate?.() ?? data.createdAt ?? null;
          const updatedAt = data.updatedAt?.toDate?.() ?? data.updatedAt ?? null;
          return {
            id: docSnap.id,
            name: data.name || "",
            status: data.status || null,
            description: data.description || null,
            createdAt,
            updatedAt,
          };
        })
        .filter(Boolean);
      observer({ data: list, error: null });
    },
    (error) => observer({ data: null, error })
  );
}

export async function createAssignment({ customerId, coachId, status = DEFAULT_TRAJECT_STATUS }) {
  if (!customerId || !coachId) {
    throw new Error("customerId and coachId are verplicht");
  }

  const currentUser = auth.currentUser;
  const createdBy = currentUser?.uid ?? null;

  const resolvedStatus = normalizeTrajectStatus(status) || DEFAULT_TRAJECT_STATUS;

  const assignmentRef = doc(db, "assignments", customerId);
  const previousSnapshot = await getDoc(assignmentRef).catch(() => null);
  const previousData = previousSnapshot && previousSnapshot.exists() ? previousSnapshot.data() : null;
  const previousCoachId = previousData?.coachId || null;
  const existingCreatedAt = previousData?.createdAt || null;
  const existingCreatedBy = previousData?.createdBy || null;
  const existingHistoryRaw = Array.isArray(previousData?.statusHistory) ? previousData.statusHistory : [];
  const existingHistory = sanitizeHistoryForStorage(existingHistoryRaw);

  const batch = writeBatch(db);

  const now = Timestamp.now();
  const statusTimestamp = Timestamp.now();
  const historyTimestamp = Timestamp.now();
  const historyEntry = {
    status: resolvedStatus,
    changedAt: historyTimestamp,
    changedBy: createdBy || existingCreatedBy || null,
    changedByRole: createdBy ? "admin" : previousData?.statusUpdatedByRole || null,
  };
  const trimmedHistory =
    existingHistory.length >= STATUS_HISTORY_LIMIT
      ? existingHistory.slice(-(STATUS_HISTORY_LIMIT - 1))
      : existingHistory;
  const statusHistory = [...trimmedHistory, historyEntry];

  const assignmentPayload = {
    customerId,
    coachId,
    status: resolvedStatus,
    createdBy: existingCreatedBy || createdBy || null,
    updatedAt: now,
    statusUpdatedAt: statusTimestamp,
    statusUpdatedBy: historyEntry.changedBy || null,
    statusUpdatedByRole: historyEntry.changedByRole || null,
    statusHistory,
  };
  if (!existingCreatedAt) {
    assignmentPayload.createdAt = now;
  } else {
    assignmentPayload.createdAt = existingCreatedAt;
  }
  batch.set(assignmentRef, assignmentPayload, { merge: true });

  const customerRef = doc(db, "users", customerId);
  batch.set(
    customerRef,
    {
      coachId,
      coachLinkedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const coachLinkRef = doc(db, "assignmentsByCoach", coachId, "customers", customerId);
  const coachLinkPayload = {
    customerId,
    coachId,
    status: resolvedStatus,
    createdBy: existingCreatedBy || createdBy || null,
    updatedAt: now,
    statusUpdatedAt: statusTimestamp,
    statusUpdatedBy: historyEntry.changedBy || null,
    statusUpdatedByRole: historyEntry.changedByRole || null,
    statusHistory,
  };
  if (!existingCreatedAt) {
    coachLinkPayload.createdAt = now;
  } else {
    coachLinkPayload.createdAt = existingCreatedAt;
  }
  batch.set(coachLinkRef, coachLinkPayload, { merge: true });

  if (previousCoachId && previousCoachId !== coachId) {
    const previousCoachRef = doc(db, "assignmentsByCoach", previousCoachId, "customers", customerId);
    batch.delete(previousCoachRef);
  }

  await batch.commit();

  if (!previousData) {
    const assignmentsCollection = collection(db, "assignments");
    const duplicatesSnapshot = await getDocs(query(assignmentsCollection, where("customerId", "==", customerId)));
    const staleDocs = duplicatesSnapshot.docs.filter((docSnap) => docSnap.id !== customerId);
    if (staleDocs.length > 0) {
      const cleanupBatch = writeBatch(db);
      staleDocs.forEach((docSnap) => cleanupBatch.delete(docSnap.ref));
      await cleanupBatch.commit();
    }
  }
}

export function subscribeAdminProfile(uid, observer) {
  if (!uid) {
    observer({ data: null, error: new Error("Missing uid") });
    return () => {};
  }

  const baseRef = doc(db, "users", uid);
  const overlayRef = doc(db, "adminProfiles", uid);

  let baseData = null;
  let overlayData = null;
  let baseError = null;
  let overlayError = null;

  const emit = () => {
    if (baseError || overlayError) {
      observer({ data: null, error: baseError || overlayError });
      return;
    }
    if (!baseData) {
      observer({ data: null, error: null });
      return;
    }
    observer({ data: { ...baseData, ...overlayData }, error: null });
  };

  const unsubscribeBase = onSnapshot(
    baseRef,
    (snapshot) => {
      baseData = mapDoc(snapshot);
      baseError = null;
      emit();
    },
    (error) => {
      baseError = error;
      emit();
    }
  );

  const unsubscribeOverlay = onSnapshot(
    overlayRef,
    (snapshot) => {
      overlayData = snapshot.exists() ? snapshot.data() : null;
      overlayError = null;
      emit();
    },
    (error) => {
      overlayError = error;
      emit();
    }
  );

  return () => {
    unsubscribeBase();
    unsubscribeOverlay();
  };
}

export async function fetchUserDoc(uid) {
  if (!uid) return null;
  const docRef = doc(db, "users", uid);
  const snapshot = await getDoc(docRef);
  return mapDoc(snapshot);
}

export async function fetchAdminProfile(uid) {
  if (!uid) return null;
  const [baseSnap, overlaySnap] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "adminProfiles", uid)).catch(() => null),
  ]);
  const base = mapDoc(baseSnap);
  const overlay = overlaySnap && overlaySnap.exists() ? overlaySnap.data() : null;
  if (!base) return null;
  return { ...base, ...overlay };
}

export async function getUsersIndex() {
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);
  const map = new Map();
  snapshot.forEach((docSnap) => {
    const record = mapDoc(docSnap);
    if (record) {
      map.set(record.id, record);
    }
  });
  return map;
}
