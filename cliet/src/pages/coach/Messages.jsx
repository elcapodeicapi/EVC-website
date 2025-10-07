import React, { useEffect, useMemo, useState } from "react";
import ChatWindow from "../../components/ChatWindow";
import LoadingSpinner from "../../components/LoadingSpinner";
import { threads, threadMessages } from "../../data/mockData";

const CoachMessages = () => {
  const coachThreads = useMemo(
    () => threads.filter((thread) => thread.name.includes("Isabelle")),
    []
  );
  const [activeThreadId, setActiveThreadId] = useState(coachThreads[0]?.id ?? "");
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeThreadId) return;
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(timeout);
  }, [activeThreadId]);

  const messages = useMemo(() => threadMessages[activeThreadId] ?? [], [activeThreadId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
        <p className="text-sm text-slate-500">Stay connected with your customers and admins.</p>
      </div>
      {loading ? (
        <LoadingSpinner label="Loading messages" />
      ) : (
        <ChatWindow
          threads={coachThreads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          messages={messages}
          draft={drafts[activeThreadId] ?? ""}
          onDraftChange={(value) =>
            setDrafts((prev) => ({ ...prev, [activeThreadId]: value }))
          }
          onSend={() => {
            alert("Mock send message");
            setDrafts((prev) => ({ ...prev, [activeThreadId]: "" }));
          }}
          emptyLabel="Select a thread to see the conversation"
        />
      )}
    </div>
  );
};

export default CoachMessages;
