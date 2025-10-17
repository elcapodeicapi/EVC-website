import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  sendThreadMessage,
  subscribeThreadMessages,
  subscribeThreadsForUser,
} from "../../lib/firestoreMessages";

const resolveUid = (entity) =>
  entity?.firebaseUid || entity?.uid || entity?.id || entity?.userId || null;

const formatTimestamp = (value) => {
  if (!(value instanceof Date)) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
};

const CoachMessages = () => {
  const { coach } = useOutletContext() ?? {};
  const coachId = resolveUid(coach);
  const coachName = coach?.name || coach?.email || "Coach";

  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState(null);

  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesError, setMessagesError] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!coachId) {
      setThreads([]);
      setThreadsLoading(false);
      setThreadsError(new Error("Geen coachprofiel gevonden"));
      return () => {};
    }

    const unsubscribe = subscribeThreadsForUser(coachId, "coach", ({ data, error }) => {
      if (error) {
        setThreadsError(error);
        setThreads([]);
        setThreadsLoading(false);
        return;
      }
      setThreads(Array.isArray(data) ? data : []);
      setThreadsError(null);
      setThreadsLoading(false);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [coachId]);

  useEffect(() => {
    if (threads.length === 0) {
      setActiveThreadId(null);
      return;
    }
    setActiveThreadId((previous) => {
      if (previous && threads.some((thread) => thread.id === previous)) {
        return previous;
      }
      return threads[0]?.id || null;
    });
  }, [threads]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      setMessagesError(null);
      setMessagesLoading(false);
      return () => {};
    }
    setMessagesLoading(true);
    const unsubscribe = subscribeThreadMessages(activeThreadId, ({ data, error }) => {
      if (error) {
        setMessagesError(error);
        setMessages([]);
        setMessagesLoading(false);
        return;
      }
      setMessages(Array.isArray(data) ? data : []);
      setMessagesError(null);
      setMessagesLoading(false);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [activeThreadId]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const formattedMessages = useMemo(() => {
    return messages.map((message) => ({
      ...message,
      isOwn: message.senderId === coachId,
      timestampLabel: formatTimestamp(message.timestamp),
      senderInitial: (message.senderName || "?").charAt(0).toUpperCase(),
    }));
  }, [messages, coachId]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!activeThread || !coachId) return;
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle && !trimmedBody) return;
    if (!activeThread.otherParticipantId) return;

    setSending(true);
    setMessagesError(null);
    try {
      await sendThreadMessage({
        threadId: activeThread.id,
        senderId: coachId,
        receiverId: activeThread.otherParticipantId,
        senderRole: "coach",
        senderName: coachName,
        receiverName: activeThread.otherParticipantName || "Deelnemer",
        messageTitle: trimmedTitle,
        messageText: trimmedBody,
        file,
      });
      setTitle("");
      setBody("");
      setFile(null);
    } catch (error) {
      setMessagesError(error);
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Berichten</h2>
        <p className="text-sm text-slate-500">Beheer de communicatie met je klanten op één plek.</p>
      </header>

      {threadsError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {threadsError.message || "Kon gesprekken niet laden."}
        </div>
      ) : null}

      {threadsLoading ? (
        <LoadingSpinner label="Gesprekken laden" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
          <aside className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Gesprekken</p>
            <ul className="space-y-2">
              {threads.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                  Nog geen gesprekken
                </li>
              ) : (
                threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => setActiveThreadId(thread.id)}
                      className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${
                        thread.id === activeThreadId
                          ? "bg-evc-blue-50 text-evc-blue-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{thread.otherParticipantName}</p>
                      <p className="truncate text-xs text-slate-500">{thread.lastMessageSnippet || "Nieuw gesprek"}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            {activeThread ? (
              <div className="flex flex-col gap-6 px-6 py-6">
                <header>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">
                    Contact met {activeThread.otherParticipantName || "deelnemer"}
                  </p>
                </header>

                {messagesError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {messagesError.message || "Kon berichten niet laden."}
                  </div>
                ) : null}

                {messagesLoading ? (
                  <LoadingSpinner label="Berichten laden" />
                ) : (
                  <div className="max-h-[500px] space-y-4 overflow-y-auto pr-1">
                    {formattedMessages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center text-sm text-slate-400">
                        Nog geen berichten in dit gesprek.
                      </div>
                    ) : (
                      formattedMessages.map((message) => (
                        <article
                          key={message.id}
                          className={`flex gap-4 rounded-2xl border px-4 py-4 shadow-sm ${
                            message.isOwn ? "border-evc-blue-100 bg-evc-blue-50/60" : "border-slate-100 bg-slate-50"
                          }`}
                        >
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                            message.isOwn ? "bg-evc-blue-600 text-white" : "bg-slate-200 text-slate-700"
                          }`}>
                            {message.senderInitial}
                          </div>
                          <div className="flex-1 space-y-2">
                            <header className="flex flex-wrap items-baseline justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {message.senderName}
                                  {message.senderRole ? (
                                    <span className="ml-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                                      {message.senderRole}
                                    </span>
                                  ) : null}
                                </p>
                                {message.messageTitle ? (
                                  <p className="text-base font-semibold text-slate-900">{message.messageTitle}</p>
                                ) : null}
                              </div>
                              <time className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                {message.timestampLabel}
                              </time>
                            </header>
                            {message.messageText ? (
                              <p className="whitespace-pre-line text-sm text-slate-700">{message.messageText}</p>
                            ) : null}
                            {message.fileUrl ? (
                              <a
                                href={message.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm font-medium text-evc-blue-700 hover:text-evc-blue-600"
                              >
                                <span aria-hidden>📎</span>
                                Download {message.fileName || "bijlage"}
                              </a>
                            ) : null}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                )}

                <form onSubmit={handleSend} className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="coach-message-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Onderwerp
                    </label>
                    <input
                      id="coach-message-title"
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Bijvoorbeeld: Update beoordeling"
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-inner focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="coach-message-body" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Bericht
                    </label>
                    <textarea
                      id="coach-message-body"
                      rows={5}
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      placeholder="Schrijf je bericht"
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-evc-blue-300 hover:text-evc-blue-600">
                      <span aria-hidden>📎</span>
                      <span>Voeg bijlage toe</span>
                      <input type="file" className="hidden" onChange={handleFileChange} />
                    </label>
                    {file ? (
                      <span className="text-sm text-slate-500">Geselecteerd: {file.name}</span>
                    ) : null}
                    <div className="flex-1" />
                    <button
                      type="submit"
                      disabled={sending}
                      className="inline-flex items-center gap-2 rounded-full bg-evc-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-evc-blue-500 disabled:cursor-not-allowed disabled:bg-evc-blue-300"
                    >
                      {sending ? "Versturen…" : "Verstuur bericht"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-12 text-sm text-slate-400">
                Selecteer een gesprek links om berichten te bekijken
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default CoachMessages;
