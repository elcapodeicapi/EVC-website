import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  ensureThread,
  sendThreadMessage,
  subscribeThreadMessages,
} from "../../lib/firestoreMessages";

const formatTimestamp = (value) => {
  if (!(value instanceof Date)) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
};

const resolveUid = (entity) =>
  entity?.firebaseUid || entity?.uid || entity?.id || entity?.userId || null;

const ROLE_LABELS = new Map([
  ["customer", "Kandidaat"],
  ["user", "Kandidaat"],
  ["coach", "Begeleider"],
  ["admin", "Beheerder"],
]);

const formatRoleLabel = (role) => {
  if (!role) return "";
  const normalized = role.toString().trim().toLowerCase();
  if (!normalized) return "";
  return ROLE_LABELS.get(normalized) || role;
};

const CustomerMessages = () => {
  const { customer, coach } = useOutletContext();
  const customerId = resolveUid(customer);
  const coachId = resolveUid(coach);

  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!customerId || !coachId) {
      setThreadId(null);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    ensureThread({
      customerId,
      coachId,
      customerProfile: {
        name: customer?.name || "",
        email: customer?.email || "",
      },
      coachProfile: {
        name: coach?.name || coach?.email || "",
        email: coach?.email || "",
      },
    })
      .then((id) => {
        if (!cancelled) {
          setThreadId(id);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Kon het gesprek niet openen");
          setThreadId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, coachId, customer?.name, customer?.email, coach?.name, coach?.email]);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return () => {};
    }

    const unsubscribe = subscribeThreadMessages(threadId, ({ data, error: subscriptionError }) => {
      if (subscriptionError) {
        setError(subscriptionError.message || "Kon berichten niet laden");
        return;
      }
      setError(null);
      setMessages(Array.isArray(data) ? data : []);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [threadId]);

  const formattedMessages = useMemo(() => {
    return messages.map((message) => ({
      ...message,
      isOwn: message.senderId === customerId,
      timestampLabel: formatTimestamp(message.timestamp),
      senderInitial: (message.senderName || "?").charAt(0).toUpperCase(),
    }));
  }, [messages, customerId]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!threadId || !customerId || !coachId) return;
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle && !trimmedBody) {
      setError("Voer een titel of bericht in");
      return;
    }

    setSending(true);
    setError(null);
    try {
      await sendThreadMessage({
        threadId,
        senderId: customerId,
        receiverId: coachId,
        senderRole: "customer",
  senderName: customer?.name || customer?.email || "Kandidaat",
  receiverName: coach?.name || coach?.email || "Begeleider",
        messageTitle: trimmedTitle,
        messageText: trimmedBody,
        file,
      });
      setTitle("");
      setBody("");
      setFile(null);
    } catch (err) {
      setError(err.message || "Verzenden mislukt");
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Contact</p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Contact met {coach?.name || coach?.email || "je begeleider"}
          </h1>
        </div>
        <p className="max-w-2xl text-sm text-slate-500">
          Stuur vragen of updates naar je begeleider. Je ontvangt automatisch een melding wanneer je begeleider reageert.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <LoadingSpinner label="Berichten laden" />
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-6 px-6 py-6">
            <div className="max-h-[500px] space-y-4 overflow-y-auto pr-1">
              {formattedMessages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center text-sm text-slate-400">
                  Nog geen berichten. Stel hieronder je eerste vraag aan je begeleider.
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
                                {formatRoleLabel(message.senderRole)}
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

            <form onSubmit={handleSend} className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4">
              <div className="grid gap-2">
                <label htmlFor="message-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Onderwerp
                </label>
                <input
                  id="message-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Bijvoorbeeld: Vraag over planning"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-inner focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="message-body" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Bericht
                </label>
                <textarea
                  id="message-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={5}
                  placeholder="Schrijf hier je bericht"
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
        </section>
      )}
    </div>
  );
};

export default CustomerMessages;
