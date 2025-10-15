import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { getUsersIndex } from "./firestoreAdmin";

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

const mapThreadMessage = (snapshot) => {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    authorId: data.authorId || data.userId || null,
    authorName: data.authorName || data.displayName || "",
    content: data.content || data.body || "",
    createdAt: normalizeTimestamp(data.createdAt) || new Date(),
  };
};

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

export function subscribeCoachThreads(coachUid, observer) {
  if (!coachUid) {
    observer({ data: [], error: new Error("coachUid ontbreekt") });
    return () => {};
  }

  const threadsRef = collection(db, "threads");
  const threadsQuery = query(threadsRef, where("participants", "array-contains", coachUid), orderBy("updatedAt", "desc"));

  return onSnapshot(
    threadsQuery,
    async (snapshot) => {
      try {
        const userIndex = await getUsersIndex().catch(() => new Map());
        const threads = snapshot.docs
          .map((docSnap) => buildThreadEntry(docSnap, coachUid, userIndex))
          .filter(Boolean)
          .sort((a, b) => {
            const timeA = a.updatedAt ? a.updatedAt.getTime() : 0;
            const timeB = b.updatedAt ? b.updatedAt.getTime() : 0;
            return timeB - timeA;
          });
        observer({ data: threads, error: null });
      } catch (error) {
        observer({ data: [], error });
      }
    },
    (error) => observer({ data: [], error })
  );
}

export function subscribeThreadMessages(threadId, observer) {
  if (!threadId) {
    observer({ data: [], error: new Error("threadId ontbreekt") });
    return () => {};
  }

  const messagesRef = collection(db, "threads", threadId, "messages");
  const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const entries = snapshot.docs.map(mapThreadMessage).filter(Boolean);
      observer({ data: entries, error: null });
    },
    (error) => observer({ data: [], error })
  );
}

export async function sendThreadMessage({ threadId, fromUserId, toUserId, body, authorName }) {
  if (!threadId) throw new Error("threadId is verplicht");
  if (!fromUserId) throw new Error("fromUserId is verplicht");
  const trimmed = (body || "").trim();
  if (!trimmed) throw new Error("Bericht mag niet leeg zijn");

  const threadRef = doc(db, "threads", threadId);
  const messagesRef = collection(threadRef, "messages");

  await addDoc(messagesRef, {
    authorId: fromUserId,
    authorName: authorName || null,
    toUserId: toUserId || null,
    content: trimmed,
    createdAt: serverTimestamp(),
  });

  await updateDoc(threadRef, {
    lastMessage: trimmed,
    lastMessageAuthorId: fromUserId,
    lastMessageAuthorName: authorName || null,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);
}
