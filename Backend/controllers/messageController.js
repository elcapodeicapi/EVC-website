const { db } = require("../firebase");


// GET all messages for the logged-in user (forum-like)
exports.getAllMessages = async (req, res) => {
  try {
    const uid = req.user.firebaseUid || req.user.uid;
    if (!uid) return res.status(400).json({ error: "Missing Firebase user id" });

    // Threads where current uid is a participant
    const threadsSnap = await db
      .collection("threads")
      .where("participants", "array-contains", uid)
      .orderBy("updatedAt", "desc")
      .get();

    const threads = await Promise.all(
      threadsSnap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const messagesSnap = await db
          .collection("threads")
          .doc(docSnap.id)
          .collection("messages")
          .orderBy("createdAt", "asc")
          .get();
        const messages = messagesSnap.docs.map((m) => ({ id: m.id, ...m.data() }));
        return { id: docSnap.id, ...data, messages };
      })
    );

    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST send message
exports.sendMessage = async (req, res) => {
  try {
    const { threadId, toUserId, content } = req.body;
    const fromUserId = req.user.firebaseUid || req.user.uid;
    if (!fromUserId) return res.status(400).json({ error: "Missing Firebase user id" });
    if (!content || !content.trim()) return res.status(400).json({ error: "Message is empty" });

    let resolvedThreadId = threadId;
    if (!resolvedThreadId) {
      // Create or find a one-on-one thread between from and to users
      const participants = [fromUserId, toUserId].filter(Boolean).sort();
      if (participants.length < 2) return res.status(400).json({ error: "Missing recipient" });

      const existing = await db
        .collection("threads")
        .where("participants", "array-contains", fromUserId)
        .get();
      const found = existing.docs.find((doc) => {
        const p = doc.data().participants || [];
        return p.length === 2 && p.includes(toUserId);
      });
      if (found) {
        resolvedThreadId = found.id;
      } else {
        const threadRef = await db.collection("threads").add({
          participants,
          participantProfiles: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        resolvedThreadId = threadRef.id;
      }
    }

    const msgRef = await db
      .collection("threads")
      .doc(resolvedThreadId)
      .collection("messages")
      .add({
        authorId: fromUserId,
        content: content.trim(),
        createdAt: new Date(),
      });

    await db.collection("threads").doc(resolvedThreadId).update({
      lastMessage: content.trim(),
      lastMessageAuthorId: fromUserId,
      updatedAt: new Date(),
    });

    const msgSnap = await msgRef.get();
    res.json({ id: msgSnap.id, ...msgSnap.data(), threadId: resolvedThreadId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
