import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { DEFAULT_TRAJECT_STATUS, normalizeTrajectStatus } from "./trajectStatus";

function normalizeTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
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

function mapDoc(snapshot) {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
    lastLoggedIn: normalizeTimestamp(data.lastLoggedIn),
  };
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
          createdAt: data.createdAt ? data.createdAt.toDate?.() ?? data.createdAt : null,
          createdBy: data.createdBy || null,
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

  const batch = writeBatch(db);

  const assignmentPayload = {
    customerId,
    coachId,
    status: resolvedStatus,
    createdBy: existingCreatedBy || createdBy || null,
    updatedAt: serverTimestamp(),
  };
  if (!existingCreatedAt) {
    assignmentPayload.createdAt = serverTimestamp();
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
    updatedAt: serverTimestamp(),
  };
  if (!existingCreatedAt) {
    coachLinkPayload.createdAt = serverTimestamp();
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
