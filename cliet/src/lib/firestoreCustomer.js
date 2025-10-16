import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";

function mapTraject(snapshot) {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    name: data.name || "",
    description: data.description || "",
    competencyCount: data.competencyCount ?? null,
    ...data,
  };
}

function coerceToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null);
  if (typeof value === "string") {
    return value
      .split(/\r?\n/) // split by newlines for convenience
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
}

function mapCompetency(snapshot) {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    code: data.code || "",
    title: data.title || "",
    description: data.description || "",
    desiredOutcome: data.desiredOutcome || data.gewenstResultaat || "",
    subjectKnowledge: coerceToArray(data.subjectKnowledge || data.vakkennis || data.vakkennisEnVaardigheden),
    behavioralComponents: coerceToArray(data.behavioralComponents || data.gedragsComponenten || data.behavioral || data.gedragscomponenten),
    groupCode: data.groupCode || "",
    groupTitle: data.groupTitle || "",
    groupOrder: data.groupOrder ?? 0,
    competencyOrder: data.competencyOrder ?? 0,
    order: data.order ?? 0,
  };
}

function mapUser(snapshot) {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    uid: snapshot.id,
    firebaseUid: snapshot.id,
    name: data.name || "",
    email: data.email || "",
    role: data.role || "",
    trajectId: data.trajectId || null,
    coachId: data.coachId || null,
    lastActivity: data.lastActivity ? data.lastActivity.toDate?.() ?? data.lastActivity : null,
  };
}

export async function fetchTraject(trajectId) {
  if (!trajectId) return null;
  const trajectRef = doc(db, "trajects", trajectId);
  const snapshot = await getDoc(trajectRef);
  return mapTraject(snapshot);
}

function selectMostRecentAssignment(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return null;
  return docs
    .map((snap) => {
      const data = snap.data() || {};
      return {
        id: snap.id,
        coachId: data.coachId || null,
        customerId: data.customerId || null,
        status: data.status || "",
        createdAt: data.createdAt ? data.createdAt.toDate?.() ?? data.createdAt : null,
      };
    })
    .sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return timeB - timeA;
    })[0];
}

function mapUpload(snapshot) {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  const uploadedAt = data.uploadedAt
    ? typeof data.uploadedAt.toDate === "function"
      ? data.uploadedAt.toDate()
      : data.uploadedAt
    : null;
  const displayName = data.name || data.displayName || data.fileName || snapshot.id;
  return {
    id: snapshot.id,
    name: displayName,
    displayName,
    fileName: data.fileName || displayName,
    downloadURL: data.downloadURL || "",
    storagePath: data.storagePath || "",
    competencyId: data.competencyId || "",
    userId: data.userId || "",
    trajectId: data.trajectId || null,
    uploadedAt,
    contentType: data.contentType || "",
    size: data.size ?? null,
  };
}

export async function uploadCustomerEvidence({ userId, competencyId, file, displayName, trajectId }) {
  if (!userId) throw new Error("userId is verplicht");
  if (!competencyId) throw new Error("competencyId is verplicht");
  if (!file) throw new Error("Bestand ontbreekt");

  const resolvedName = (displayName || file.name || "Bestand").trim();
  const safeFileName = file.name || "upload";
  const storagePath = `user_uploads/${userId}/${competencyId}/${Date.now()}-${safeFileName}`;
  const fileRef = ref(storage, storagePath);

  const metadata = file.type ? { contentType: file.type } : undefined;
  await uploadBytes(fileRef, file, metadata);
  const downloadURL = await getDownloadURL(fileRef);

  const uploadsCollection = collection(db, "users", userId, "uploads");
  await addDoc(uploadsCollection, {
    name: resolvedName,
    fileName: safeFileName,
    downloadURL,
    storagePath,
    competencyId,
    userId,
    trajectId: trajectId || null,
    uploadedAt: serverTimestamp(),
    contentType: file.type || null,
    size: typeof file.size === "number" ? file.size : null,
  });
}

export async function deleteCustomerEvidence({ userId, uploadId, storagePath }) {
  if (!userId) throw new Error("userId is verplicht");
  if (!uploadId) throw new Error("uploadId is verplicht");

  const uploadDocRef = doc(db, "users", userId, "uploads", uploadId);

  if (storagePath) {
    const fileRef = ref(storage, storagePath);
    try {
      await deleteObject(fileRef);
    } catch (error) {
      if (error?.code !== "storage/object-not-found") {
        throw error;
      }
      // if the file is already gone we still remove the Firestore doc
    }
  }

  await deleteDoc(uploadDocRef);
}

export function subscribeCustomerUploads(userId, observer) {
  if (!userId) {
    observer({ uploads: [], error: new Error("Missing user id") });
    return () => {};
  }

  const uploadsRef = collection(db, "users", userId, "uploads");
  const uploadsQuery = query(uploadsRef, orderBy("uploadedAt", "desc"));

  return onSnapshot(
    uploadsQuery,
    (snapshot) => {
      const uploads = snapshot.docs.map(mapUpload).filter(Boolean);
      observer({ uploads, error: null });
    },
    (error) => {
      observer({ uploads: [], error });
    }
  );
}

export async function resolveUploadDownloadUrl(upload) {
  if (!upload) return null;
  if (upload.downloadURL) return upload.downloadURL;
  if (!upload.storagePath) return null;
  const fileRef = ref(storage, upload.storagePath);
  return getDownloadURL(fileRef);
}

export function subscribeCustomerContext(customerUid, observer) {
  if (!customerUid) {
    observer({ customer: null, coach: null, assignment: null, error: new Error("Missing user id") });
    return () => {};
  }

  let cachedCoachListener = null;
  let currentState = { customer: null, coach: null, assignment: null };

  const emit = (patch = {}, error = null) => {
    currentState = { ...currentState, ...patch };
    observer({ ...currentState, error });
  };

  const listenToCoach = (coachId) => {
    if (cachedCoachListener) {
      cachedCoachListener();
      cachedCoachListener = null;
    }
    if (!coachId) {
      emit({ coach: null });
      return;
    }
    cachedCoachListener = onSnapshot(
      doc(db, "users", coachId),
      (snapshot) => emit({ coach: mapUser(snapshot) }),
      (error) => emit({}, error)
    );
  };

  const userUnsubscribe = onSnapshot(
    doc(db, "users", customerUid),
    (snapshot) => {
      const customer = mapUser(snapshot);
      emit({ customer });
      if (customer?.coachId) {
        listenToCoach(customer.coachId);
      }
    },
    (error) => emit({}, error)
  );

  const assignmentsRef = collection(db, "assignments");
  const assignmentsQuery = query(assignmentsRef, where("customerId", "==", customerUid));
  const assignmentsUnsubscribe = onSnapshot(
    assignmentsQuery,
    (snapshot) => {
      const assignment = selectMostRecentAssignment(snapshot.docs);
      emit({ assignment });
      if (assignment?.coachId) {
        listenToCoach(assignment.coachId);
      } else if (!currentState.coach) {
        // no assignment: keep potential coach from user doc
        emit({});
      }
    },
    (error) => emit({}, error)
  );

  return () => {
    userUnsubscribe();
    assignmentsUnsubscribe();
    if (cachedCoachListener) cachedCoachListener();
  };
}

export function subscribeTrajectCompetencies(trajectId, observer) {
  if (!trajectId) {
    observer({ data: [], error: new Error("Missing trajectId") });
    return () => {};
  }

  const rootQuery = query(collection(db, "competencies"), where("trajectId", "==", trajectId));
  const subcollectionRef = collection(db, "trajects", trajectId, "competencies");

  let rootDocs = [];
  let subDocs = [];

  const emit = (error = null) => {
    const sourceDocs = rootDocs.length > 0 ? rootDocs : subDocs;
    const entries = sourceDocs
      .map(mapCompetency)
      .filter(Boolean)
      .sort((a, b) => {
        if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
        if (a.competencyOrder !== b.competencyOrder) return a.competencyOrder - b.competencyOrder;
        if (a.order !== b.order) return a.order - b.order;
        return (a.title || "").localeCompare(b.title || "");
      });
    observer({ data: entries, error });
  };

  const unsubscribeRoot = onSnapshot(
    rootQuery,
    (snapshot) => {
      rootDocs = snapshot.docs;
      emit();
    },
    (error) => {
      rootDocs = [];
      emit(error);
    }
  );

  const unsubscribeSubcollection = onSnapshot(
    subcollectionRef,
    (snapshot) => {
      subDocs = snapshot.docs;
      if (rootDocs.length === 0) {
        emit();
      }
    },
    (error) => {
      subDocs = [];
      if (rootDocs.length === 0) {
        emit(error);
      }
    }
  );

  return () => {
    unsubscribeRoot();
    unsubscribeSubcollection();
  };
}
