import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ChatWindow from "../../components/ChatWindow";
import LoadingSpinner from "../../components/LoadingSpinner";
import { subscribeCoachThreads, subscribeThreadMessages, sendThreadMessage } from "../../lib/firestoreCoach";

const CoachMessages = () => {
  const { coach } = useOutletContext() ?? {};
  const coachId = coach?.id || null;
  const coachName = coach?.name || coach?.email || "Coach";

  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState(null);

  const [activeThreadId, setActiveThreadId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

  const [drafts, setDrafts] = useState({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  useEffect(() => {
    if (!coachId) {
      setThreads([]);
      setThreadsError(null);
      setThreadsLoading(false);
      return () => {};
    }
    setThreadsLoading(true);
    const unsubscribe = subscribeCoachThreads(coachId, ({ data, error }) => {
      setThreads(Array.isArray(data) ? data : []);
      setThreadsError(error || null);
      setThreadsLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [coachId]);

  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
      return;
    }
    if (activeThreadId && !threads.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(threads[0]?.id || "");
    }
  }, [activeThreadId, threads]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      setMessagesError(null);
      setMessagesLoading(false);
      return () => {};
    }
    setMessagesLoading(true);
    const unsubscribe = subscribeThreadMessages(activeThreadId, ({ data, error }) => {
      setMessages(Array.isArray(data) ? data : []);
      setMessagesError(error || null);
      setMessagesLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [activeThreadId]);

  const chatMessages = useMemo(() => {
    return messages.map((message) => {
      const isCoach = message.authorId === coachId;
      const timestamp = message.createdAt instanceof Date ? message.createdAt.toLocaleString() : "";
      return {
        id: message.id,
        author: message.authorName || (isCoach ? coachName : "Contact"),
        body: message.content || message.summary || "",
        timestamp,
        from: isCoach ? "me" : "other",
      };
    });
  }, [coachId, coachName, messages]);

  const handleSend = async () => {
    if (sending) return;
    if (!coachId || !activeThreadId) return;
    const text = (drafts[activeThreadId] || "").trim();
    if (!text) return;
    setSending(true);
    setSendError(null);
    try {
      const targetUserId = threads.find((thread) => thread.id === activeThreadId)?.targetUserId || null;
      await sendThreadMessage({
        threadId: activeThreadId,
        fromUserId: coachId,
        toUserId: targetUserId,
        body: text,
        authorName: coachName,
      });
      setDrafts((prev) => ({ ...prev, [activeThreadId]: "" }));
    } catch (error) {
      setSendError(error.message || "Versturen mislukt");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Berichten</h2>
        <p className="text-sm text-slate-500">Blijf in contact met je klanten en collega&apos;s.</p>
      </div>
      {threadsError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
          {threadsError.message || "Kon gesprekken niet laden."}
        </div>
      ) : null}
      {threadsLoading && threads.length === 0 ? (
        <LoadingSpinner label="Gesprekken laden" />
      ) : (
        <>
          {messagesError ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-700">
              {messagesError.message || "Kon berichten niet laden."}
            </div>
          ) : null}
          {messagesLoading ? (
            <LoadingSpinner label="Berichten laden" />
          ) : (
            <ChatWindow
              threads={threads}
              activeThreadId={activeThreadId}
              onSelectThread={(threadId) => {
                setActiveThreadId(threadId);
                setSendError(null);
              }}
              messages={chatMessages}
              draft={drafts[activeThreadId] ?? ""}
              onDraftChange={(value) => {
                setDrafts((prev) => ({ ...prev, [activeThreadId]: value }));
                setSendError(null);
              }}
              onSend={handleSend}
              emptyLabel="Selecteer een gesprek om het bericht te bekijken"
            />
          )}
        </>
      )}
      {sendError ? (
        <p className="text-sm text-rose-600">{sendError}</p>
      ) : null}
    </div>
  );
};

export default CoachMessages;
