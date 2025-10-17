import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { getUsersIndex } from "./firestoreAdmin";

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    } catch (error) {
      return null;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildThreadId = (customerId, coachId) => {
  return [customerId, coachId]
    .filter(Boolean)
    .map((value) => String(value))
    .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
    .join("__");
};

export const resolveThreadId = buildThreadId;

export async function ensureThread({
  customerId,
  coachId,
  customerProfile = {},
  coachProfile = {},
}) {
  if (!customerId || !coachId) return null;
  const threadId = buildThreadId(customerId, coachId);
  const threadRef = doc(db, "threads", threadId);
  const snapshot = await getDoc(threadRef);

  const participantProfiles = {
    [customerId]: {
      id: customerId,
      role: "customer",
      name: customerProfile.name || "",
      email: customerProfile.email || "",
    },
    [coachId]: {
      id: coachId,
      role: "coach",
      name: coachProfile.name || "",
      email: coachProfile.email || "",
    },
  };

  if (!snapshot.exists()) {
    await setDoc(threadRef, {
      participants: [customerId, coachId],
      customerId,
      coachId,
      participantProfiles,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return threadId;
  }

  const existing = snapshot.data() || {};
  const mergedProfiles = {
    ...(existing.participantProfiles || {}),
    ...participantProfiles,
  };

  await updateDoc(threadRef, {
    participantProfiles: mergedProfiles,
    customerId: existing.customerId || customerId,
    coachId: existing.coachId || coachId,
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);

  return threadId;
}

const mapThreadDoc = (docSnap) => {
  if (!docSnap?.exists()) return null;
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    customerId: data.customerId || null,
    coachId: data.coachId || null,
    participants: Array.isArray(data.participants) ? data.participants : [],
    participantProfiles: data.participantProfiles || {},
    lastMessageTitle: data.lastMessageTitle || data.lastMessage || "",
    lastMessageSnippet: data.lastMessageSnippet || data.lastMessage || "",
    lastMessageAt: normalizeDate(data.lastMessageAt) || normalizeDate(data.updatedAt),
    updatedAt: normalizeDate(data.updatedAt),
    createdAt: normalizeDate(data.createdAt),
  };
};

export function subscribeThreadsForUser(userId, role, observer) {
  if (!userId) {
    observer({ data: [], error: new Error("userId ontbreekt") });
    return () => {};
  }

  const threadsRef = collection(db, "threads");
  const isAdmin = String(role).toLowerCase() === "admin";
  const threadsQuery = isAdmin
    ? query(threadsRef, orderBy("updatedAt", "desc"))
    : query(threadsRef, where("participants", "array-contains", userId), orderBy("updatedAt", "desc"));

  return onSnapshot(
    threadsQuery,
    async (snapshot) => {
      try {
        const userIndex = await getUsersIndex().catch(() => new Map());
        const threads = snapshot.docs
          .map((docSnap) => mapThreadDoc(docSnap))
          .filter(Boolean)
          .map((thread) => {
            const profiles = thread.participantProfiles || {};
            const otherParticipantId = thread.participants.find((id) => id !== userId) || null;
            const otherProfile = profiles[otherParticipantId] || userIndex.get(otherParticipantId) || {};
            return {
              ...thread,
              otherParticipantId,
              otherParticipantName:
                otherProfile.name || otherProfile.email || (otherParticipantId ? otherParticipantId.slice(0, 6) : ""),
              otherParticipantRole: otherProfile.role || null,
            };
          })
          .sort((a, b) => {
            const timeA = a.lastMessageAt ? a.lastMessageAt.getTime() : 0;
            const timeB = b.lastMessageAt ? b.lastMessageAt.getTime() : 0;
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

const mapMessageDoc = (docSnap) => {
  if (!docSnap?.exists()) return null;
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    senderId: data.senderId || null,
    receiverId: data.receiverId || null,
    senderRole: data.senderRole || null,
    senderName: data.senderName || "",
    receiverName: data.receiverName || "",
    messageTitle: data.messageTitle || "",
    messageText: data.messageText || "",
    timestamp: normalizeDate(data.timestamp) || normalizeDate(data.createdAt) || new Date(),
    fileUrl: data.fileUrl || null,
    fileName: data.fileName || null,
  };
};

export function subscribeThreadMessages(threadId, observer) {
  if (!threadId) {
    observer({ data: [], error: new Error("threadId ontbreekt") });
    return () => {};
  }

  const messagesRef = collection(db, "threads", threadId, "messages");
  const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const records = snapshot.docs.map(mapMessageDoc).filter(Boolean);
      observer({ data: records, error: null });
    },
    (error) => observer({ data: [], error })
  );
}

function buildMessagePreview(messageTitle, messageText) {
  const parts = [];
  if (messageTitle) parts.push(messageTitle.trim());
  if (messageText) parts.push(messageText.trim());
  const combined = parts.join(" – ");
  if (combined.length <= 140) return combined;
  return `${combined.slice(0, 137)}…`;
}

export async function sendThreadMessage({
  threadId,
  senderId,
  receiverId,
  senderRole,
  senderName,
  receiverName,
  messageTitle,
  messageText,
  file,
}) {
  if (!threadId) throw new Error("threadId ontbreekt");
  if (!senderId) throw new Error("senderId ontbreekt");
  const title = (messageTitle || "").trim();
  const text = (messageText || "").trim();
  if (!title && !text) throw new Error("Het bericht heeft geen inhoud");

  const messagesCollection = collection(db, "threads", threadId, "messages");
  const messageRef = doc(messagesCollection);

  let fileUrl = null;
  let fileName = null;
  if (file) {
    fileName = file.name;
    const storageRef = ref(storage, `messages/${threadId}/${messageRef.id}/${file.name}`);
    await uploadBytes(storageRef, file);
    fileUrl = await getDownloadURL(storageRef);
  }

  await setDoc(messageRef, {
    senderId,
    receiverId: receiverId || null,
    senderRole: senderRole || null,
    senderName: senderName || "",
    receiverName: receiverName || "",
    messageTitle: title,
    messageText: text,
    fileUrl,
    fileName,
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  const threadRef = doc(db, "threads", threadId);
  await updateDoc(threadRef, {
    lastMessageTitle: title,
    lastMessageSnippet: buildMessagePreview(title, text),
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: senderId,
    lastMessageSenderName: senderName || "",
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);

  return messageRef.id;
}

export async function fetchThreadParticipants(threadId) {
  if (!threadId) return { thread: null, participants: [] };
  const docRef = doc(db, "threads", threadId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return { thread: null, participants: [] };
  const thread = mapThreadDoc(snapshot);
  const participantIds = thread.participants || [];
  if (participantIds.length === 0) {
    return { thread, participants: [] };
  }
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("uid", "in", participantIds.slice(0, 10)));
  const usersSnap = await getDocs(q).catch(() => null);
  const participants = usersSnap
    ? usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
    : [];
  return { thread, participants };
}
