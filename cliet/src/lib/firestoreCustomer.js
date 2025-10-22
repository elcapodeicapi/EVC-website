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
  setDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import { DEFAULT_TRAJECT_STATUS, normalizeTrajectStatus } from "./trajectStatus";
import { normalizeQuestionnaireResponses, questionnaireIsComplete } from "./questionnaire";

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

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    try {
      const converted = value.toDate();
      return Number.isNaN(converted.getTime()) ? null : converted;
    } catch (_) {
      return null;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function normalizeStatusHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const status = normalizeTrajectStatus(entry.status);
      if (!status) return null;
      const changedAt = normalizeDate(entry.changedAt);
      const note = typeof entry.note === "string" && entry.note.trim() ? entry.note.trim() : null;
      const changedByRole = typeof entry.changedByRole === "string" ? entry.changedByRole : null;
      return {
        status,
        changedAt,
        changedAtMillis: changedAt instanceof Date ? changedAt.getTime() : null,
        changedBy: entry.changedBy || null,
        changedByRole,
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

const emptyEvcTrajectory = () => ({
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

const mapEvcTrajectory = (raw = {}) => {
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
    updatedAt: normalizeDate(raw.updatedAt || raw.lastUpdated || null),
  };
};

const mapProfileDoc = (snapshot) => {
  if (!snapshot?.exists()) {
    return {
      evcTrajectory: emptyEvcTrajectory(),
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
    evcTrajectory: mapEvcTrajectory(evcTrajectory || {}),
    updatedAt: normalizeDate(data.updatedAt || data.lastUpdated || null),
  };
};

const mapQuestionnaireHistoryEntries = (history) => {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const entryUpdatedAt = normalizeDate(entry.updatedAt || entry.timestamp || entry.date || null);
      return {
        ...entry,
        updatedAt: entryUpdatedAt,
        updatedAtMillis: entryUpdatedAt instanceof Date ? entryUpdatedAt.getTime() : 0,
      };
    })
    .filter(Boolean);
};

const emptyQuestionnaireRecord = () => ({
  responses: normalizeQuestionnaireResponses(),
  completed: false,
  updatedAt: null,
  completedAt: null,
  updatedBy: null,
  lastEditedBy: null,
  history: [],
  updatedAtMillis: 0,
  completedAtMillis: 0,
});

const mapQuestionnaireDoc = (snapshot) => {
  if (!snapshot?.exists()) {
    return emptyQuestionnaireRecord();
  }
  const data = snapshot.data() || {};
  const responses = normalizeQuestionnaireResponses(data.responses || data.sections || {});
  const history = mapQuestionnaireHistoryEntries(data.history);
  const completedFlag = data.completed === true || questionnaireIsComplete(responses);
  const updatedAt = normalizeDate(data.updatedAt || data.lastUpdated || null);
  const completedAt = normalizeDate(data.completedAt || null);
  return {
    responses,
    completed: completedFlag,
    updatedAt,
    completedAt,
    updatedBy: data.updatedBy || null,
    lastEditedBy: data.lastEditedBy || null,
    history,
    updatedAtMillis: updatedAt instanceof Date ? updatedAt.getTime() : 0,
    completedAtMillis: completedAt instanceof Date ? completedAt.getTime() : 0,
  };
};

const mapInlineQuestionnaireRecord = (record) => {
  if (!record || typeof record !== "object") return null;
  const responses = normalizeQuestionnaireResponses(record.responses || record.sections || {});
  const history = mapQuestionnaireHistoryEntries(record.history);
  const completedFlag = record.completed === true || questionnaireIsComplete(responses);
  const updatedAt = normalizeDate(record.updatedAt || record.lastUpdated || record.completedAt || null);
  const completedAt = normalizeDate(record.completedAt || null);
  return {
    responses,
    completed: completedFlag,
    updatedAt,
    completedAt,
    updatedBy: record.updatedBy || null,
    lastEditedBy: record.lastEditedBy || record.updatedBy || null,
    history,
    updatedAtMillis: updatedAt instanceof Date ? updatedAt.getTime() : 0,
    completedAtMillis: completedAt instanceof Date ? completedAt.getTime() : 0,
  };
};

function selectMostRecentAssignment(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return null;
  return docs
    .map((snap) => {
      const data = snap.data() || {};
      const status = normalizeTrajectStatus(data.status) || DEFAULT_TRAJECT_STATUS;
      const statusUpdatedAt = normalizeDate(data.statusUpdatedAt);
      return {
        id: snap.id,
        coachId: data.coachId || null,
        customerId: data.customerId || null,
        status,
        createdAt: data.createdAt ? data.createdAt.toDate?.() ?? data.createdAt : null,
        statusUpdatedAt,
        statusUpdatedBy: data.statusUpdatedBy || null,
        statusUpdatedByRole: data.statusUpdatedByRole || null,
        statusHistory: normalizeStatusHistory(data.statusHistory),
      };
    })
    .sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return timeB - timeA;
    })[0];
}

const toFirestoreTimestamp = (value) => {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : Timestamp.fromDate(value);
  }
  if (typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return Number.isNaN(date?.getTime()) ? null : Timestamp.fromDate(date);
    } catch (_) {
      return null;
    }
  }
  if (typeof value.seconds === "number") {
    return new Timestamp(value.seconds, value.nanoseconds ?? 0);
  }
  if (typeof value._seconds === "number") {
    return new Timestamp(value._seconds, value._nanoseconds ? Math.floor(value._nanoseconds) : 0);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
};

const sanitizeQuestionnaireHistoryForStorage = (history) => {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const updatedAt =
        toFirestoreTimestamp(entry.updatedAt || entry.completedAt || entry.timestamp || entry.date) || null;
      const completed = entry.completed === true || entry.isComplete === true || Boolean(entry.completed);
      const updatedBy = entry.updatedBy || null;
      const lastEditedBy = entry.lastEditedBy || entry.updatedBy || null;
      if (!updatedAt) return null;
      const sanitized = {
        completed,
        updatedAt,
      };
      if (updatedBy) sanitized.updatedBy = updatedBy;
      if (lastEditedBy) sanitized.lastEditedBy = lastEditedBy;
      return sanitized;
    })
    .filter(Boolean);
};

const QUESTIONNAIRE_HISTORY_LIMIT = 50;

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
    uploadedAt: Timestamp.now(),
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

export function subscribeCustomerProfileDetails(userId, observer) {
  if (!userId) {
    observer({ data: { evcTrajectory: emptyEvcTrajectory() }, error: new Error("Missing user id") });
    return () => {};
  }

  const profileRef = doc(db, "users", userId, "profile", "details");
  return onSnapshot(
    profileRef,
    (snapshot) => {
      observer({ data: mapProfileDoc(snapshot), error: null });
    },
    (error) => observer({ data: { evcTrajectory: emptyEvcTrajectory() }, error })
  );
}

export function subscribeCustomerQuestionnaire(userId, observer) {
  if (!userId) {
    observer({ data: emptyQuestionnaireRecord(), error: new Error("Missing user id") });
    return () => {};
  }

  const questionnaireRef = doc(db, "users", userId, "profile", "questionnaire");
  const profileDetailsRef = doc(db, "users", userId, "profile", "details");
  const resumeRef = doc(db, "profiles", userId);

  let questionnaireState = null;
  let profileState = null;
  let resumeState = null;
  let questionnaireError = null;
  let profileError = null;
  let resumeError = null;

  const emit = () => {
    const error = questionnaireError || profileError || resumeError;
    if (error) {
      observer({ data: emptyQuestionnaireRecord(), error });
      return;
    }

    const candidates = [questionnaireState, profileState, resumeState].filter(Boolean);
    if (candidates.length === 0) {
      observer({ data: emptyQuestionnaireRecord(), error: null });
      return;
    }

    const sorted = candidates.sort((a, b) => {
      const aTime = Math.max(a?.updatedAtMillis || 0, a?.completedAtMillis || 0);
      const bTime = Math.max(b?.updatedAtMillis || 0, b?.completedAtMillis || 0);
      return bTime - aTime;
    });

    const selected = sorted[0];
    const { updatedAtMillis, completedAtMillis, ...rest } = selected || {};
    observer({
      data: {
        ...emptyQuestionnaireRecord(),
        ...rest,
        updatedAtMillis: updatedAtMillis || 0,
        completedAtMillis: completedAtMillis || 0,
      },
      error: null,
    });
  };

  const unsubscribeQuestionnaire = onSnapshot(
    questionnaireRef,
    (snapshot) => {
      questionnaireError = null;
      questionnaireState = snapshot?.exists() ? mapQuestionnaireDoc(snapshot) : null;
      emit();
    },
    (error) => {
      questionnaireError = error;
      emit();
    }
  );

  const unsubscribeProfile = onSnapshot(
    profileDetailsRef,
    (snapshot) => {
      profileError = null;
      if (!snapshot?.exists()) {
        profileState = null;
        emit();
        return;
      }
      const data = snapshot.data() || {};
      const inlineRecord = data.questionnaire ? mapInlineQuestionnaireRecord(data.questionnaire) : null;
      if (inlineRecord) {
        const fallbackUpdatedAt = normalizeDate(data.questionnaireUpdatedAt || data.updatedAt || null);
        if (fallbackUpdatedAt instanceof Date && inlineRecord.updatedAtMillis === 0) {
          inlineRecord.updatedAt = inlineRecord.updatedAt || fallbackUpdatedAt;
          inlineRecord.updatedAtMillis = fallbackUpdatedAt.getTime();
        }
      }
      profileState = inlineRecord;
      emit();
    },
    (error) => {
      profileError = error;
      emit();
    }
  );

  const unsubscribeResume = onSnapshot(
    resumeRef,
    (snapshot) => {
      resumeError = null;
      if (!snapshot?.exists()) {
        resumeState = null;
        emit();
        return;
      }
      const data = snapshot.data() || {};
      const inlineRecord = data.questionnaire ? mapInlineQuestionnaireRecord(data.questionnaire) : null;
      if (inlineRecord) {
        const fallbackUpdatedAt = normalizeDate(data.questionnaireUpdatedAt || data.updatedAt || null);
        if (fallbackUpdatedAt instanceof Date && inlineRecord.updatedAtMillis === 0) {
          inlineRecord.updatedAt = inlineRecord.updatedAt || fallbackUpdatedAt;
          inlineRecord.updatedAtMillis = fallbackUpdatedAt.getTime();
        }
        const extraHistory = mapQuestionnaireHistoryEntries(data.questionnaireHistory);
        if (extraHistory.length > 0) {
          const mergedHistory = [...inlineRecord.history, ...extraHistory];
          mergedHistory.sort((a, b) => (a.updatedAtMillis || 0) - (b.updatedAtMillis || 0));
          const seenHistory = new Set();
          inlineRecord.history = mergedHistory.filter((entry) => {
            const key = `${entry.updatedAtMillis || 0}-${entry.updatedBy || ""}-${entry.completed ? 1 : 0}`;
            if (seenHistory.has(key)) return false;
            seenHistory.add(key);
            return true;
          });
        }
      }
      resumeState = inlineRecord;
      emit();
    },
    (error) => {
      resumeError = error;
      emit();
    }
  );

  return () => {
    if (typeof unsubscribeQuestionnaire === "function") unsubscribeQuestionnaire();
    if (typeof unsubscribeProfile === "function") unsubscribeProfile();
    if (typeof unsubscribeResume === "function") unsubscribeResume();
  };
}

export async function updateCustomerProfileDetails(userId, payload) {
  if (!userId) throw new Error("Missing user id");
  const profileRef = doc(db, "users", userId, "profile", "details");

  const evc = payload?.evcTrajectory ? payload.evcTrajectory : payload || {};
  const domainsValue = typeof evc.domains === "string" ? evc.domains.trim() : Array.isArray(evc.domains) ? evc.domains.join(", ") : "";

  const qualification = {
    name: evc.qualification?.name || "",
    number: evc.qualification?.number || "",
    validity: evc.qualification?.validity || "",
  };

  await setDoc(
    profileRef,
    {
      evcTrajectory: {
        contactPerson: evc.contactPerson || "",
        currentRole: evc.currentRole || "",
        domains: domainsValue,
        qualification,
        voluntaryParticipation: Boolean(evc.voluntaryParticipation),
        updatedAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}

export async function saveCustomerQuestionnaireResponses(userId, responses, options = {}) {
  if (!userId) throw new Error("Missing user id");
  const questionnaireRef = doc(db, "users", userId, "profile", "questionnaire");
  const normalizedResponses = normalizeQuestionnaireResponses(responses || {});
  const isComplete = questionnaireIsComplete(normalizedResponses);
  const updatedBy = options?.updatedBy || null;
  const lastEditedBy = options?.lastEditedBy || updatedBy || null;
  const questionnaireName = options?.name || "Vragenlijst Loopbaan en Burgerschap";

  const historyTimestamp = Timestamp.now();
  const historyEntry = {
    completed: isComplete,
    updatedAt: historyTimestamp,
  };
  if (updatedBy) historyEntry.updatedBy = updatedBy;
  if (lastEditedBy) historyEntry.lastEditedBy = lastEditedBy;

  const resumeRef = doc(db, "profiles", userId);

  const [questionnaireSnapshot, resumeSnapshot] = await Promise.all([
    getDoc(questionnaireRef).catch(() => null),
    getDoc(resumeRef).catch(() => null),
  ]);

  const existingQuestionnaireHistory = sanitizeQuestionnaireHistoryForStorage(
    questionnaireSnapshot?.data()?.history
  );
  const trimmedQuestionnaireHistory =
    existingQuestionnaireHistory.length >= QUESTIONNAIRE_HISTORY_LIMIT
      ? existingQuestionnaireHistory.slice(-(QUESTIONNAIRE_HISTORY_LIMIT - 1))
      : existingQuestionnaireHistory;
  const nextQuestionnaireHistory = [...trimmedQuestionnaireHistory, historyEntry];

  await setDoc(
    questionnaireRef,
    {
      responses: normalizedResponses,
      completed: isComplete,
      updatedAt: historyTimestamp,
      completedAt: isComplete ? historyTimestamp : null,
      updatedBy,
      lastEditedBy,
      name: questionnaireName,
      title: questionnaireName,
      history: nextQuestionnaireHistory,
    },
    { merge: true }
  );

  const profileDetailsRef = doc(db, "users", userId, "profile", "details");
  await setDoc(
    profileDetailsRef,
    {
      questionnaire: {
        responses: normalizedResponses,
        completed: isComplete,
        updatedAt: historyTimestamp,
        completedAt: isComplete ? historyTimestamp : null,
        updatedBy,
        lastEditedBy,
        name: questionnaireName,
        title: questionnaireName,
      },
      questionnaireCompleted: isComplete,
      questionnaireUpdatedAt: historyTimestamp,
    },
    { merge: true }
  );
  const resumeHistoryEntry = {
    completed: isComplete,
    updatedAt: historyTimestamp,
  };
  if (updatedBy) resumeHistoryEntry.updatedBy = updatedBy;
  if (lastEditedBy) resumeHistoryEntry.lastEditedBy = lastEditedBy;

  const existingResumeHistory = sanitizeQuestionnaireHistoryForStorage(
    resumeSnapshot?.data()?.questionnaireHistory
  );
  const trimmedResumeHistory =
    existingResumeHistory.length >= QUESTIONNAIRE_HISTORY_LIMIT
      ? existingResumeHistory.slice(-(QUESTIONNAIRE_HISTORY_LIMIT - 1))
      : existingResumeHistory;
  const nextResumeHistory = [...trimmedResumeHistory, resumeHistoryEntry];

  await setDoc(
    resumeRef,
    {
      questionnaire: {
        responses: normalizedResponses,
        completed: isComplete,
        updatedAt: historyTimestamp,
        completedAt: isComplete ? historyTimestamp : null,
        updatedBy,
        lastEditedBy,
        name: questionnaireName,
        title: questionnaireName,
      },
      questionnaireCompleted: isComplete,
      questionnaireUpdatedAt: historyTimestamp,
      questionnaireHistory: nextResumeHistory,
    },
    { merge: true }
  );

  return { responses: normalizedResponses, completed: isComplete };
}
