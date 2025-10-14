import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase";

function mapDoc(snapshot) {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
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
        return {
          id: docSnap.id,
          customerId: data.customerId || null,
          coachId: data.coachId || null,
          status: data.status || "pending",
          createdAt: data.createdAt ? data.createdAt.toDate?.() ?? data.createdAt : null,
          createdBy: data.createdBy || null,
        };
      });
      observer({ data: entries, error: null });
    },
    (error) => observer({ data: null, error })
  );
}

export async function createAssignment({ customerId, coachId, status = "pending" }) {
  if (!customerId || !coachId) {
    throw new Error("customerId and coachId are verplicht");
  }

  const currentUser = auth.currentUser;
  const createdBy = currentUser?.uid ?? null;

  const assignmentsRef = collection(db, "assignments");
  await addDoc(assignmentsRef, {
    customerId,
    coachId,
    status,
    createdBy,
    createdAt: serverTimestamp(),
  });
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
