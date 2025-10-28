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
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { getUsersIndex } from "./firestoreAdmin";
import { subscribeCustomerUploads, subscribeTrajectCompetencies } from "./firestoreCustomer";
import { DEFAULT_TRAJECT_STATUS, normalizeTrajectStatus } from "./trajectStatus";
import { normalizeQuestionnaireResponses, questionnaireIsComplete } from "./questionnaire";
import { Timestamp } from "firebase/firestore";

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
    lastLoggedIn: normalizeTimestamp(data.lastLoggedIn),
  };
};

const mapAssignmentDoc = (snapshot) => {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  const status = normalizeTrajectStatus(data.status) || DEFAULT_TRAJECT_STATUS;
  return {
    id: snapshot.id,
    coachId: data.coachId || null,
    customerId: data.customerId || null,
    status,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
    statusUpdatedAt: normalizeTimestamp(data.statusUpdatedAt),
    statusUpdatedBy: data.statusUpdatedBy || null,
    statusUpdatedByRole: data.statusUpdatedByRole || null,
    statusHistory: mapStatusHistory(data.statusHistory),
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

const mapStatusHistory = (history) => {
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

const emptyCoachQuestionnaire = () => ({
  id: "current",
  name: "Vragenlijst Loopbaan en Burgerschap",
  responses: normalizeQuestionnaireResponses(),
  completed: false,
  updatedAt: null,
  completedAt: null,
  updatedBy: null,
  lastEditedBy: null,
});

const mapCoachQuestionnaireDoc = (snapshot) => {
  if (!snapshot?.exists()) {
    return emptyCoachQuestionnaire();
  }
  const data = snapshot.data() || {};
  const responses = normalizeQuestionnaireResponses(data.responses || data.sections || {});
  const completedFlag = data.completed === true || questionnaireIsComplete(responses);
  return {
    id: data.id || snapshot.id || "current",
    name: data.name || "Vragenlijst Loopbaan en Burgerschap",
    responses,
    completed: completedFlag,
    updatedAt: normalizeTimestamp(data.updatedAt || data.lastUpdated || null),
    completedAt: normalizeTimestamp(data.completedAt || null),
    updatedBy: data.updatedBy || null,
    lastEditedBy: data.lastEditedBy || null,
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

const asArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((entry) => entry !== undefined && entry !== null);
  return [];
};

const cloneEntry = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  return { ...entry };
};

const mergeUniqueByKey = (primary = [], secondary = []) => {
  const result = [];
  const seen = new Set();
  [...primary, ...secondary].forEach((entry) => {
    if (!entry) return;
    const key = entry.id || entry.name || entry.title || null;
    const dedupeKey = key ? `${typeof key}-${key}` : JSON.stringify(entry);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push(entry);
  });
  return result;
};

const emptyCoachResume = () => ({
  dateOfBirth: "",
  placeOfBirth: "",
  nationality: "",
  phoneFixed: "",
  phoneMobile: "",
  street: "",
  houseNumber: "",
  addition: "",
  postalCode: "",
  city: "",
  educationItems: [],
  educations: [],
  certificates: [],
  workExperience: [],
  questionnaires: [],
  questionnaireHistory: [],
  questionnaire: null,
  questionnaireCompleted: false,
  photoURL: null,
});

const mapCoachProfileResumeDoc = (snapshot) => {
  if (!snapshot?.exists()) {
    return emptyCoachResume();
  }
  const data = snapshot.data() || {};
  const toStringSafe = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    return String(value).trim();
  };
  const normalizeEntries = (entries) => asArray(entries).map((entry) => {
    const candidate = cloneEntry(entry);
    if (!candidate) return null;
    const mapped = { ...candidate };
    if (mapped.startDate) mapped.startDate = toStringSafe(mapped.startDate);
    if (mapped.endDate) mapped.endDate = toStringSafe(mapped.endDate);
    if (mapped.updatedAt) mapped.updatedAt = normalizeTimestamp(mapped.updatedAt);
    if (mapped.submittedAt) mapped.submittedAt = normalizeTimestamp(mapped.submittedAt);
    if (mapped.completedAt) mapped.completedAt = normalizeTimestamp(mapped.completedAt);
    return mapped;
  }).filter(Boolean);

  return {
    dateOfBirth: toStringSafe(data.dateOfBirth),
    placeOfBirth: toStringSafe(data.placeOfBirth || data.birthplace),
    nationality: toStringSafe(data.nationality),
    phoneFixed: toStringSafe(data.phoneFixed),
    phoneMobile: toStringSafe(data.phoneMobile),
    street: toStringSafe(data.street),
    houseNumber: toStringSafe(data.houseNumber),
    addition: toStringSafe(data.addition),
    postalCode: toStringSafe(data.postalCode),
    city: toStringSafe(data.city),
    educationItems: normalizeEntries(data.educationItems),
    educations: normalizeEntries(data.educations),
    certificates: normalizeEntries(data.certificates),
    workExperience: normalizeEntries(data.workExperience),
    questionnaires: normalizeEntries(data.questionnaires),
    questionnaireHistory: normalizeEntries(data.questionnaireHistory),
    questionnaire: data.questionnaire || null,
    questionnaireCompleted: Boolean(data.questionnaireCompleted),
    photoURL: data.photoURL || data.photoUrl || null,
  };
};

const emptyCareerGoalRecord = () => ({
  content: "",
  updatedAt: null,
  updatedBy: null,
  updatedByRole: null,
  impersonatedBy: null,
});

const mapCoachCareerGoalDoc = (snapshot) => {
  if (!snapshot?.exists()) {
    return emptyCareerGoalRecord();
  }
  const data = snapshot.data() || {};
  return {
    content: typeof data.content === "string" ? data.content : "",
    updatedAt: normalizeTimestamp(data.updatedAt || data.lastUpdated || null),
    updatedBy: data.updatedBy || null,
    updatedByRole: data.updatedByRole || null,
    impersonatedBy: data.impersonatedBy || null,
  };
};

const mapCareerGoalToProfile = (record) => {
  const content = typeof record?.content === "string" ? record.content.trim() : "";
  if (!content) return null;
  const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) || "";
  const trimmedSummary = content.length > 280 ? `${content.slice(0, 277).trim()}…` : content;
  return {
    title: firstLine || "Loopbaandoel",
    summary: trimmedSummary,
    description: content,
    content,
    updatedAt: record?.updatedAt || null,
    updatedBy: record?.updatedBy || null,
    updatedByRole: record?.updatedByRole || null,
    impersonatedBy: record?.impersonatedBy || null,
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

export async function updateCoachProfile(uid, payload = {}) {
  if (!uid) throw new Error("Missing uid");

  const userRef = doc(db, "users", uid);
  const overlayRef = doc(db, "coachProfiles", uid);

  const hasOwn = Object.prototype.hasOwnProperty;
  const normalizeString = (value) => {
    if (typeof value === "string") return value.trim();
    if (value === null || value === undefined) return "";
    return String(value).trim();
  };
  const pickString = (key) => (hasOwn.call(payload, key) ? normalizeString(payload[key]) : undefined);

  const name = pickString("name");
  const phone = pickString("phone");
  const phoneMobile = pickString("phoneMobile");
  const phoneFixed = pickString("phoneFixed");
  const location = pickString("location");
  const city = pickString("city");
  const bio = hasOwn.call(payload, "bio") ? normalizeString(payload.bio) : undefined;
  const dateOfBirth = pickString("dateOfBirth");
  const placeOfBirth = pickString("placeOfBirth");
  const nationality = pickString("nationality");
  const street = pickString("street");
  const houseNumber = pickString("houseNumber");
  const addition = pickString("addition");
  const postalCode = pickString("postalCode");

  const userUpdate = {};
  if (name !== undefined) userUpdate.name = name;
  const resolvedPhone = phoneMobile !== undefined ? phoneMobile : phone;
  if (resolvedPhone !== undefined) {
    userUpdate.phone = resolvedPhone;
  }
  if (location !== undefined) {
    userUpdate.location = location;
  } else if (city !== undefined && !hasOwn.call(payload, "location")) {
    userUpdate.location = city;
  }

  const overlayUpdate = {};
  if (bio !== undefined) overlayUpdate.bio = bio;
  if (phoneFixed !== undefined) overlayUpdate.phoneFixed = phoneFixed;
  if (phoneMobile !== undefined) overlayUpdate.phoneMobile = phoneMobile;
  if (dateOfBirth !== undefined) overlayUpdate.dateOfBirth = dateOfBirth;
  if (placeOfBirth !== undefined) overlayUpdate.placeOfBirth = placeOfBirth;
  if (nationality !== undefined) overlayUpdate.nationality = nationality;
  if (street !== undefined) overlayUpdate.street = street;
  if (houseNumber !== undefined) overlayUpdate.houseNumber = houseNumber;
  if (addition !== undefined) overlayUpdate.addition = addition;
  if (postalCode !== undefined) overlayUpdate.postalCode = postalCode;
  if (city !== undefined) overlayUpdate.city = city;

  const operations = [];
  const now = serverTimestamp();
  if (Object.keys(userUpdate).length > 0) {
    userUpdate.updatedAt = now;
    operations.push(setDoc(userRef, userUpdate, { merge: true }));
  }

  if (Object.keys(overlayUpdate).length > 0) {
    overlayUpdate.updatedAt = now;
    operations.push(setDoc(overlayRef, overlayUpdate, { merge: true }));
  }

  if (operations.length === 0) return;

  await Promise.all(operations);
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
  /**
   * Subscribe to a single assignment for a given customer that is also owned by the provided coach.
   * Falls back to null if none found or permission denied.
   */
  export function subscribeAssignmentForCoach(customerId, coachUid, observer) {
    if (!customerId || !coachUid) {
      observer({ data: null, error: new Error("customerId en coachUid zijn verplicht") });
      return () => {};
    }
    const assignmentsRef = collection(db, "assignments");
    const q = query(
      assignmentsRef,
      where("customerId", "==", customerId),
      where("coachId", "==", coachUid),
      limit(1)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const docSnap = snapshot.docs[0];
        const item = docSnap ? mapAssignmentDoc(docSnap) : null;
        observer({ data: item, error: null });
      },
      (error) => observer({ data: null, error })
    );
  }


export function subscribeCoordinatorAssignments(coordinatorUid, observer) {
  if (!coordinatorUid) {
    observer({ data: [], error: new Error("coordinatorUid ontbreekt") });
    return () => {};
  }

  const ref = collection(db, "assignmentsByCoordinator", coordinatorUid, "customers");
  const q = query(ref, orderBy("statusUpdatedAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const assignments = snapshot.docs.map(mapAssignmentDoc).filter(Boolean);
      observer({ data: assignments, error: null });
    },
    (error) => observer({ data: [], error })
  );
}

export function subscribeAssessorAssignments(assessorUid, observer) {
  if (!assessorUid) {
    observer({ data: [], error: new Error("assessorUid ontbreekt") });
    return () => {};
  }

  const ref = collection(db, "assignmentsByAssessor", assessorUid, "customers");
  const q = query(ref, orderBy("statusUpdatedAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const assignments = snapshot.docs.map(mapAssignmentDoc).filter(Boolean);
      observer({ data: assignments, error: null });
    },
    (error) => observer({ data: [], error })
  );
}

// Subscribe to a single assignment document by customerId
export function subscribeAssignmentByCustomerId(customerId, observer) {
  if (!customerId) {
    observer({ data: null, error: new Error("customerId ontbreekt") });
    return () => {};
  }
  const ref = doc(db, "assignments", customerId);
  return onSnapshot(
    ref,
    (snapshot) => {
      const item = mapAssignmentDoc(snapshot);
      observer({ data: item, error: null });
    },
    (error) => observer({ data: null, error })
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
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
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
  const resumeRef = doc(db, "profiles", customerId);
  const careerGoalRef = doc(db, "careerGoals", customerId);
  const questionnaireRef = doc(db, "users", customerId, "profile", "questionnaire");

  let customerData = null;
  let profileData = { evcTrajectory: emptyCoachEvcTrajectory(), updatedAt: null };
  let resumeData = emptyCoachResume();
  let careerGoalData = emptyCareerGoalRecord();
  let questionnaireData = emptyCoachQuestionnaire();
  let customerError = null;
  let profileError = null;
  let resumeError = null;
  let careerGoalError = null;
  let questionnaireError = null;

  const buildComposedProfile = () => {
    const questionnaireEntry = questionnaireData
      ? {
          id: "current-questionnaire",
          name: "Vragenlijst Loopbaan en Burgerschap",
          responses: questionnaireData.responses,
          updatedAt: questionnaireData.updatedAt,
          completed: questionnaireData.completed,
        }
      : null;
    const questionnaires = mergeUniqueByKey(
      asArray(profileData?.questionnaires).map(cloneEntry),
      asArray(resumeData?.questionnaires).map(cloneEntry).concat(questionnaireEntry ? [questionnaireEntry] : [])
    );
    const questionnaireHistory = mergeUniqueByKey(
      mergeUniqueByKey(
        asArray(profileData?.questionnaireHistory).map(cloneEntry),
        asArray(resumeData?.questionnaireHistory).map(cloneEntry)
      ),
      asArray(questionnaireData?.history).map(cloneEntry)
    );
    const questionnaire = questionnaireData || profileData?.questionnaire || resumeData?.questionnaire || null;
    const questionnaireCompleted =
      questionnaireData?.completed === true ||
      profileData?.questionnaireCompleted === true ||
      resumeData?.questionnaireCompleted === true ||
      questionnaireIsComplete(questionnaireData?.responses || {});

    const resume = resumeData || emptyCoachResume();
    const workExperienceFromProfile = asArray(profileData?.workExperience);
    const workExperience = workExperienceFromProfile.length > 0 ? workExperienceFromProfile : asArray(resume.workExperience);

    const mergedProfile = {
      ...resume,
      ...profileData,
      resume,
      questionnaires,
      questionnaireHistory,
      questionnaire,
      questionnaireCompleted,
  questionnaireRecord: questionnaireData,
      workExperience,
      placeOfBirth: profileData?.placeOfBirth || profileData?.birthplace || resume.placeOfBirth || "",
      birthplace: profileData?.birthplace || profileData?.placeOfBirth || resume.placeOfBirth || "",
      phone: profileData?.phone || profileData?.phoneMobile || resume.phoneMobile || resume.phoneFixed || "",
      photoURL: profileData?.photoURL || resume.photoURL || customerData?.photoURL || null,
      careerGoal: mapCareerGoalToProfile(careerGoalData),
    };

    if (!mergedProfile.dateOfBirth && resume.dateOfBirth) {
      mergedProfile.dateOfBirth = resume.dateOfBirth;
    }

    if (!mergedProfile.educations || mergedProfile.educations.length === 0) {
      mergedProfile.educations = asArray(resume.educations);
    }

    if (!mergedProfile.certificates || mergedProfile.certificates.length === 0) {
      mergedProfile.certificates = asArray(resume.certificates);
    }

    return mergedProfile;
  };

  const emit = () => {
    const firstError = customerError || profileError || resumeError || careerGoalError || questionnaireError;
    if (firstError) {
      observer({ data: null, error: firstError });
      return;
    }

    const composedProfile = buildComposedProfile();
    const resolvedCareerGoal = composedProfile?.careerGoal || mapCareerGoalToProfile(careerGoalData);

    observer({
      data: {
        customer: customerData,
        profile: composedProfile,
        resume: resumeData,
        careerGoal: resolvedCareerGoal,
        questionnaire: questionnaireData,
        evcTrajectory: composedProfile?.evcTrajectory || emptyCoachEvcTrajectory(),
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

  const unsubscribeResume = onSnapshot(
    resumeRef,
    (snapshot) => {
      resumeData = mapCoachProfileResumeDoc(snapshot);
      resumeError = null;
      emit();
    },
    (error) => {
      resumeData = emptyCoachResume();
      resumeError = error;
      emit();
    }
  );

  const unsubscribeCareerGoal = onSnapshot(
    careerGoalRef,
    (snapshot) => {
      careerGoalData = mapCoachCareerGoalDoc(snapshot);
      careerGoalError = null;
      emit();
    },
    (error) => {
      careerGoalData = emptyCareerGoalRecord();
      careerGoalError = error;
      emit();
    }
  );

  const unsubscribeQuestionnaire = onSnapshot(
    questionnaireRef,
    (snapshot) => {
      questionnaireData = mapCoachQuestionnaireDoc(snapshot);
      questionnaireError = null;
      emit();
    },
    (error) => {
      questionnaireData = emptyCoachQuestionnaire();
      questionnaireError = error;
      emit();
    }
  );

  emit();

  return () => {
    if (typeof unsubscribeCustomer === "function") unsubscribeCustomer();
    if (typeof unsubscribeProfile === "function") unsubscribeProfile();
    if (typeof unsubscribeResume === "function") unsubscribeResume();
    if (typeof unsubscribeCareerGoal === "function") unsubscribeCareerGoal();
    if (typeof unsubscribeQuestionnaire === "function") unsubscribeQuestionnaire();
  };
}

export async function updateCoachCustomerVoluntary({ customerId, voluntaryParticipation }) {
  if (!customerId) throw new Error("customerId ontbreekt");
  const profileRef = doc(db, "users", customerId, "profile", "details");
  const payload = {
    "evcTrajectory.voluntaryParticipation": Boolean(voluntaryParticipation),
    "evcTrajectory.updatedAt": Timestamp.now(),
    updatedAt: Timestamp.now(),
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
          updatedAt: Timestamp.now(),
        },
        updatedAt: Timestamp.now(),
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
      coachUnlinkedAt: Timestamp.now(),
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
    lastEdited: Timestamp.now(),
  };

  if (existingTimestamp instanceof Date && !Number.isNaN(existingTimestamp.getTime())) {
    payload.timestamp = existingTimestamp;
  } else if (!existingTimestamp) {
    payload.timestamp = Timestamp.now();
  }

  await setDoc(noteRef, payload, { merge: true });
}
