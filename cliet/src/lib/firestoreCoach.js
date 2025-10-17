import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { getUsersIndex } from "./firestoreAdmin";
import { subscribeCustomerUploads, subscribeTrajectCompetencies } from "./firestoreCustomer";

const normalizeTimestamp = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    try {
      const result = value.toDate();
      return Number.isNaN(result.getTime()) ? null : result;
    } catch (_) {
      return null;
    }
  }
  const converted = new Date(value);
  return Number.isNaN(converted.getTime()) ? null : converted;
};

const mapUserDoc = (snapshot) => {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    ...data,
    lastActivity: normalizeTimestamp(data.lastActivity),
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
};

const mapAssignmentDoc = (snapshot) => {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    coachId: data.coachId || null,
    customerId: data.customerId || null,
    status: data.status || "pending",
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
};

const mapNoteDoc = (snapshot) => {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    coachId: data.coachId || null,
    customerId: data.customerId || null,
    text: data.text || "",
    timestamp: normalizeTimestamp(data.timestamp),
    lastEdited: normalizeTimestamp(data.lastEdited) || normalizeTimestamp(data.timestamp),
  };
};

const mapFeedbackDoc = (snapshot) => {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  const updatedAt = normalizeTimestamp(data.updatedAt) || normalizeTimestamp(data.createdAt);
  return {
    id: snapshot.id,
    coachId: data.coachId || null,
    coachName: data.coachName || "",
    customerId: data.customerId || null,
    customerName: data.customerName || "",
    competencyId: data.competencyId || "",
    summary: data.summary || data.status || "",
    content: data.content || data.body || "",
    updatedAt,
    createdAt: normalizeTimestamp(data.createdAt),
  };
};

const buildThreadEntry = (snapshot, coachId, userIndex) => {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  const participantsRaw = Array.isArray(data.participants)
    ? data.participants
    : Array.isArray(data.participantIds)
    ? data.participantIds
    : [];
  const participantIds = participantsRaw
    .map((participant) => (typeof participant === "string" ? participant : participant?.id))
    .filter(Boolean);
  const otherParticipantId = participantIds.find((id) => id !== coachId) || null;
  const profiles = data.participantProfiles || {};

  let displayName = data.title || data.name || "";
  if (!displayName && otherParticipantId && profiles[otherParticipantId]?.name) {
    displayName = profiles[otherParticipantId].name;
  }
  if (!displayName && otherParticipantId && profiles[otherParticipantId]?.email) {
    displayName = profiles[otherParticipantId].email;
  }
  if (!displayName && otherParticipantId && userIndex?.has(otherParticipantId)) {
    const user = userIndex.get(otherParticipantId);
    displayName = user.name || user.email || `Gesprek met ${otherParticipantId.slice(0, 6)}`;
  }
  if (!displayName) {
    displayName = "Gesprek";
  }

  const updatedAt =
    normalizeTimestamp(data.updatedAt) ||
    normalizeTimestamp(data.lastMessageAt) ||
    normalizeTimestamp(data.createdAt);

  return {
    id: snapshot.id,
    name: displayName,
    lastMessage: data.lastMessage || "",
    updatedAt,
    participantIds,
    targetUserId: otherParticipantId || null,
  };
};

const emptyCoachEvcTrajectory = () => ({
  contactPerson: "",
  currentRole: "",
  domains: "",
  qualification: {
    name: "",
    number: "",
    validity: "",
  },
  voluntaryParticipation: false,
  updatedAt: null,
});

const mapCoachEvcTrajectory = (raw = {}) => {
  const qualification = raw.qualification || {};
  return {
    contactPerson: raw.contactPerson || "",
    currentRole: raw.currentRole || "",
    domains: Array.isArray(raw.domains) ? raw.domains.join(", ") : raw.domains || "",
    qualification: {
      name: qualification.name || raw.qualificationName || "",
      number: qualification.number || raw.qualificationNumber || "",
      validity: qualification.validity || raw.qualificationValidity || "",
    },
    voluntaryParticipation: Boolean(raw.voluntaryParticipation),
    updatedAt: normalizeTimestamp(raw.updatedAt || raw.lastUpdated || null),
  };
};

const mapCoachProfileDetailsDoc = (snapshot) => {
  if (!snapshot?.exists()) {
    return {
      evcTrajectory: emptyCoachEvcTrajectory(),
      updatedAt: null,
      photoURL: null,
    };
  }
  const data = snapshot.data() || {};
  const { evcTrajectory, ...rest } = data;
  const photoURL = data.photoURL || data.photoUrl || null;
  return {
    ...rest,
    photoURL,
    evcTrajectory: mapCoachEvcTrajectory(evcTrajectory || {}),
    updatedAt: normalizeTimestamp(data.updatedAt || data.lastUpdated || null),
  };
};

// Deprecated message helpers are removed. Messaging logic now lives in firestoreMessages.js

export function subscribeCoachProfile(coachUid, observer) {
  if (!coachUid) {
    observer({ data: null, error: new Error("coachUid ontbreekt") });
    return () => {};
  }

  const baseRef = doc(db, "users", coachUid);
  const overlayRef = doc(db, "coachProfiles", coachUid);

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
      baseData = mapUserDoc(snapshot);
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
      overlayData = snapshot?.exists() ? snapshot.data() : null;
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

export function subscribeCoachCustomers(coachUid, observer) {
  if (!coachUid) {
    observer({ data: [], error: new Error("coachUid ontbreekt") });
    return () => {};
  }

  const customersRef = collection(db, "users");
  const customersQuery = query(customersRef, where("coachId", "==", coachUid));

  return onSnapshot(
    customersQuery,
    (snapshot) => {
      const customers = snapshot.docs
        .map(mapUserDoc)
        .filter(Boolean)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      observer({ data: customers, error: null });
    },
    (error) => observer({ data: [], error })
  );
}

export function subscribeCoachAssignments(coachUid, observer) {
  if (!coachUid) {
    observer({ data: [], error: new Error("coachUid ontbreekt") });
    return () => {};
  }

  const assignmentsRef = collection(db, "assignments");
  const assignmentsQuery = query(assignmentsRef, where("coachId", "==", coachUid), orderBy("createdAt", "desc"));

  return onSnapshot(
    assignmentsQuery,
    (snapshot) => {
      const assignments = snapshot.docs.map(mapAssignmentDoc).filter(Boolean);
      observer({ data: assignments, error: null });
    },
    (error) => observer({ data: [], error })
  );
}

export function subscribeCoachFeedback(coachUid, observer) {
  if (!coachUid) {
    observer({ data: [], error: new Error("coachUid ontbreekt") });
    return () => {};
  }

  const feedbackRef = collection(db, "feedback");
  const feedbackQuery = query(feedbackRef, where("coachId", "==", coachUid), orderBy("updatedAt", "desc"));

  return onSnapshot(
    feedbackQuery,
    (snapshot) => {
      const entries = snapshot.docs.map(mapFeedbackDoc).filter(Boolean);
      observer({ data: entries, error: null });
    },
    (error) => observer({ data: [], error })
  );
}

export function subscribeCustomerFeedback(customerId, observer) {
  if (!customerId) {
    observer({ data: [], error: new Error("customerId ontbreekt") });
    return () => {};
  }

  const feedbackRef = collection(db, "feedback");
  const feedbackQuery = query(feedbackRef, where("customerId", "==", customerId), orderBy("updatedAt", "desc"));

  return onSnapshot(
    feedbackQuery,
    (snapshot) => {
      const entries = snapshot.docs.map(mapFeedbackDoc).filter(Boolean);
      observer({ data: entries, error: null });
    },
    (error) => observer({ data: [], error })
  );
}

export async function addCoachFeedback({ coachId, coachName, customerId, customerName, competencyId, body }) {
  if (!coachId) throw new Error("coachId is verplicht");
  if (!customerId) throw new Error("customerId is verplicht");
  if (!competencyId) throw new Error("competencyId is verplicht");
  const trimmed = (body || "").trim();
  if (!trimmed) throw new Error("Feedbacktekst is verplicht");

  const feedbackRef = collection(db, "feedback");
  await addDoc(feedbackRef, {
    coachId,
    coachName: coachName || null,
    customerId,
    customerName: customerName || null,
    competencyId,
    content: trimmed,
    summary: trimmed.slice(0, 90),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Legacy thread helpers retained elsewhere

const emptyProgressState = (meta = {}) => ({
  trajectId: meta.trajectId || null,
  trajectName: meta.trajectName || "",
  trajectCode: meta.trajectCode || "",
  totalCompetencies: 0,
  completedCompetencies: 0,
  completionPercentage: 0,
  competencies: [],
  uploadsByCompetency: {},
});

export function subscribeCustomerProgress(customerId, trajectId, observer) {
  if (!customerId) {
    observer({ data: emptyProgressState(), error: new Error("customerId ontbreekt") });
    return () => {};
  }

  if (!trajectId) {
    observer({ data: emptyProgressState(), error: null });
    return () => {};
  }

  let competencies = [];
  let uploads = [];
  let trajectInfo = null;
  let competenciesError = null;
  let uploadsError = null;
  let trajectError = null;

  const emit = () => {
    const uploadsByCompetency = competencies.reduce((acc, competency) => {
      acc[competency.id] = [];
      return acc;
    }, {});

    uploads.forEach((upload) => {
      const list = uploadsByCompetency[upload.competencyId] || (uploadsByCompetency[upload.competencyId] = []);
      list.push(upload);
    });

    const totalCompetencies = competencies.length;
    const completedCompetencies = competencies.filter(
      (competency) => (uploadsByCompetency[competency.id] || []).length > 0
    ).length;
    const completionPercentage = totalCompetencies > 0 ? Math.round((completedCompetencies / totalCompetencies) * 100) : 0;

    observer({
      data: {
        trajectId,
        trajectName: trajectInfo?.name || "",
        trajectCode: trajectInfo?.code || "",
        totalCompetencies,
        completedCompetencies,
        completionPercentage,
        competencies,
        uploadsByCompetency,
      },
      error: competenciesError || uploadsError || trajectError || null,
    });
  };

  observer({ data: emptyProgressState({ trajectId }), error: null });

  const trajectRef = doc(db, "trajects", trajectId);

  const unsubscribeTraject = onSnapshot(
    trajectRef,
    (snapshot) => {
      const data = snapshot?.data() || {};
      trajectInfo = {
        id: snapshot?.id || trajectId,
        name: data.name || data.title || "",
        code: data.code || "",
      };
      trajectError = null;
      emit();
    },
    (error) => {
      trajectInfo = null;
      trajectError = error;
      emit();
    }
  );

  const unsubscribeCompetencies = subscribeTrajectCompetencies(trajectId, ({ data, error }) => {
    competencies = Array.isArray(data) ? data : [];
    competenciesError = error || null;
    emit();
  });

  const unsubscribeUploads = subscribeCustomerUploads(customerId, ({ uploads: uploadDocs, error }) => {
    uploads = Array.isArray(uploadDocs) ? uploadDocs : [];
    uploadsError = error || null;
    emit();
  });

  return () => {
    if (typeof unsubscribeTraject === "function") unsubscribeTraject();
    if (typeof unsubscribeCompetencies === "function") unsubscribeCompetencies();
    if (typeof unsubscribeUploads === "function") unsubscribeUploads();
  };
}

export function subscribeCoachCustomerNote(coachId, customerId, observer) {
  if (!coachId || !customerId) {
    observer({ data: null, error: new Error("coachId of customerId ontbreekt") });
    return () => {};
  }

  const noteRef = doc(db, "notes", coachId, "customers", customerId);
  return onSnapshot(
    noteRef,
    (snapshot) => observer({ data: mapNoteDoc(snapshot), error: null }),
    (error) => observer({ data: null, error })
  );
}

export function subscribeCoachCustomerProfile(customerId, observer) {
  if (!customerId) {
    observer({ data: null, error: new Error("customerId ontbreekt") });
    return () => {};
  }

  const customerRef = doc(db, "users", customerId);
  const profileRef = doc(db, "users", customerId, "profile", "details");

  let customerData = null;
  let profileData = { evcTrajectory: emptyCoachEvcTrajectory(), updatedAt: null };
  let customerError = null;
  let profileError = null;

  const emit = () => {
    if (customerError || profileError) {
      observer({ data: null, error: customerError || profileError });
      return;
    }

    observer({
      data: {
        customer: customerData,
        profile: profileData,
        evcTrajectory: profileData?.evcTrajectory || emptyCoachEvcTrajectory(),
      },
      error: null,
    });
  };

  const unsubscribeCustomer = onSnapshot(
    customerRef,
    (snapshot) => {
      customerData = mapUserDoc(snapshot);
      customerError = null;
      emit();
    },
    (error) => {
      customerData = null;
      customerError = error;
      emit();
    }
  );

  const unsubscribeProfile = onSnapshot(
    profileRef,
    (snapshot) => {
      profileData = mapCoachProfileDetailsDoc(snapshot);
      profileError = null;
      emit();
    },
    (error) => {
      profileData = { evcTrajectory: emptyCoachEvcTrajectory(), updatedAt: null };
      profileError = error;
      emit();
    }
  );

  emit();

  return () => {
    if (typeof unsubscribeCustomer === "function") unsubscribeCustomer();
    if (typeof unsubscribeProfile === "function") unsubscribeProfile();
  };
}

export async function updateCoachCustomerVoluntary({ customerId, voluntaryParticipation }) {
  if (!customerId) throw new Error("customerId ontbreekt");
  const profileRef = doc(db, "users", customerId, "profile", "details");
  const payload = {
    "evcTrajectory.voluntaryParticipation": Boolean(voluntaryParticipation),
    "evcTrajectory.updatedAt": serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(profileRef, payload);
  } catch (error) {
    if (error?.code !== "not-found") throw error;
    const defaults = emptyCoachEvcTrajectory();
    await setDoc(
      profileRef,
      {
        evcTrajectory: {
          ...defaults,
          voluntaryParticipation: Boolean(voluntaryParticipation),
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export async function deleteCoachCustomer({ coachId, customerId }) {
  if (!coachId) throw new Error("coachId ontbreekt");
  if (!customerId) throw new Error("customerId ontbreekt");

  const assignmentRef = doc(db, "assignments", customerId);
  const userRef = doc(db, "users", customerId);
  const coachLinkRef = doc(db, "assignmentsByCoach", coachId, "customers", customerId);

  const batch = writeBatch(db);
  batch.delete(coachLinkRef);
  batch.delete(assignmentRef);
  batch.set(
    userRef,
    {
      coachId: null,
      coachLinkedAt: null,
      coachUnlinkedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}

export async function saveCoachCustomerNote({ coachId, customerId, text, existingTimestamp }) {
  if (!coachId) throw new Error("coachId ontbreekt");
  if (!customerId) throw new Error("customerId ontbreekt");
  const noteRef = doc(db, "notes", coachId, "customers", customerId);
  const payload = {
    coachId,
    customerId,
    text: typeof text === "string" ? text : "",
    lastEdited: serverTimestamp(),
  };

  if (existingTimestamp instanceof Date && !Number.isNaN(existingTimestamp.getTime())) {
    payload.timestamp = existingTimestamp;
  } else if (!existingTimestamp) {
    payload.timestamp = serverTimestamp();
  }

  await setDoc(noteRef, payload, { merge: true });
}
