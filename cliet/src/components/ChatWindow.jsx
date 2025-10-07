import React from "react";
import { Send } from "lucide-react";

const ChatWindow = ({
  threads = [],
  activeThreadId,
  onSelectThread,
  messages = [],
  draft,
  onDraftChange,
  onSend,
  emptyLabel = "No thread selected",
}) => {
  return (
    <div className="grid h-[600px] grid-cols-1 overflow-hidden rounded-3xl bg-white shadow-card lg:grid-cols-[280px,1fr]">
      <aside className="border-r border-slate-100">
        <div className="px-4 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Conversations
          </h3>
        </div>
        <div className="h-full overflow-y-auto px-2 pb-6">
          <ul className="space-y-1">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => onSelectThread?.(thread.id)}
                  className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${
                    activeThreadId === thread.id
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold text-slate-900">{thread.name}</p>
                  <p className="truncate text-xs text-slate-500">{thread.lastMessage}</p>
                </button>
              </li>
            ))}
            {threads.length === 0 ? (
              <li className="px-4 py-12 text-center text-sm text-slate-400">
                No threads yet.
              </li>
            ) : null}
          </ul>
        </div>
      </aside>

      <section className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="m-auto text-center text-sm text-slate-400">
              <p>{emptyLabel}</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`max-w-md rounded-2xl px-4 py-3 text-sm shadow-sm ${message.from === "me" ? "self-end bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                <p className="text-xs uppercase tracking-wide text-white/80">{message.author}</p>
                <p className="mt-1 whitespace-pre-line">{message.body}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide opacity-60">{message.timestamp}</p>
              </div>
            ))
          )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSend?.();
          }}
          className="border-t border-slate-100 bg-slate-50/60 px-6 py-4"
        >
          <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-inner">
            <input
              type="text"
              value={draft ?? ""}
              onChange={(event) => onDraftChange?.(event.target.value)}
              placeholder="Type a message"
              className="flex-1 border-none bg-transparent text-sm outline-none focus:ring-0"
            />
            <button
              type="submit"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-500"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default ChatWindow;
