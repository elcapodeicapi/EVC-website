import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ChatWindow from "../../components/ChatWindow";
import LoadingSpinner from "../../components/LoadingSpinner";
import { get, post } from "../../lib/api";

const CustomerMessages = () => {
  const { customer, coach, account } = useOutletContext();

  const currentUserId = account?.id ?? null;
  const [threads, setThreads] = useState([]);
  const [messagesByThread, setMessagesByThread] = useState({});
  const [activeThreadId, setActiveThreadId] = useState("");
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const mapMessagesToThreads = useCallback(
    (rawMessages) => {
      const threadMap = new Map();

      rawMessages.forEach((message) => {
        const fromUser = message?.fromUser || {};
        const toUser = message?.toUser || {};
        const outgoing = fromUser?.id === currentUserId;
        const counterpart = outgoing ? toUser : fromUser;
        if (!counterpart?.id) return;

        const threadId = String(counterpart.id);
        if (!threadMap.has(threadId)) {
          threadMap.set(threadId, {
            id: threadId,
            name: counterpart.name || counterpart.email || "Contactpersoon",
            targetUserId: counterpart.id,
            lastMessage: "",
            lastTimestamp: 0,
            messages: [],
          });
        }

        const thread = threadMap.get(threadId);
        const createdAt = message.createdAt ? new Date(message.createdAt) : null;
        const timestampMs = createdAt ? createdAt.getTime() : Date.now();
        const authorLabel = outgoing ? customer?.name || "Ik" : counterpart.name || counterpart.email || "Contactpersoon";

        thread.messages.push({
          id: message.id,
          author: authorLabel,
          body: message.content || "",
          from: outgoing ? "me" : "other",
          timestamp: createdAt ? createdAt.toLocaleString() : "",
          timestampMs,
        });
        thread.lastMessage = message.content || thread.lastMessage;
        thread.lastTimestamp = Math.max(thread.lastTimestamp, timestampMs);
      });

      const sortedThreads = Array.from(threadMap.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
      const nextThreads = sortedThreads.map(({ id, name, lastMessage, targetUserId }) => ({
        id,
        name,
        lastMessage,
        targetUserId,
      }));

      const nextMessages = {};
      sortedThreads.forEach((thread) => {
        const ordered = thread.messages.sort((a, b) => a.timestampMs - b.timestampMs).map(({ timestampMs, ...rest }) => rest);
        nextMessages[thread.id] = ordered;
      });

      return { threads: nextThreads, messagesByThread: nextMessages };
    },
    [currentUserId, customer?.name]
  );

  const loadMessages = useCallback(async () => {
    if (!currentUserId) {
      setThreads([]);
      setMessagesByThread({});
      setActiveThreadId("");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await get("/messages");
      const normalized = mapMessagesToThreads(Array.isArray(data) ? data : []);
      setThreads(normalized.threads);
      setMessagesByThread(normalized.messagesByThread);
      setActiveThreadId((previous) => {
        if (previous && normalized.threads.some((thread) => thread.id === previous)) {
          return previous;
        }
        return normalized.threads[0]?.id ?? "";
      });
      setError(null);
    } catch (err) {
      setError(err?.data?.error || err?.message || "Berichten laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, mapMessagesToThreads]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const messages = useMemo(() => messagesByThread[activeThreadId] ?? [], [messagesByThread, activeThreadId]);

  const handleSend = async () => {
    const draft = drafts[activeThreadId] ?? "";
    const trimmed = draft.trim();
    if (!trimmed) return;

    const thread = threads.find((item) => item.id === activeThreadId);
    if (!thread?.targetUserId) {
      setError("Geen ontvanger gekoppeld aan dit gesprek.");
      return;
    }

    setSending(true);
    try {
      await post("/messages/send", { toUserId: thread.targetUserId, content: trimmed });
      setDrafts((prev) => ({ ...prev, [activeThreadId]: "" }));
      await loadMessages();
    } catch (err) {
      setError(err?.data?.error || err?.message || "Versturen mislukt");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Berichten</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Chat rechtstreeks met je coach{coach ? ` ${coach.name}` : ""}. Gebruik dit kanaal voor vragen en updates.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingSpinner label="Berichten laden" />
      ) : (
        <ChatWindow
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          messages={messages}
          draft={drafts[activeThreadId] ?? ""}
          onDraftChange={(value) =>
            setDrafts((prev) => ({ ...prev, [activeThreadId]: value }))
          }
          onSend={handleSend}
          emptyLabel={threads.length === 0 ? "Nog geen berichten. Start een gesprek met je coach." : "Selecteer een gesprek"}
        />
      )}

      {sending ? (
        <p className="text-xs text-slate-400">Bericht wordt verzonden…</p>
      ) : null}
    </div>
  );
};

export default CustomerMessages;
