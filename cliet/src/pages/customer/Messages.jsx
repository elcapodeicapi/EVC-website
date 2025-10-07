import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ChatWindow from "../../components/ChatWindow";
import LoadingSpinner from "../../components/LoadingSpinner";
import { threads, threadMessages } from "../../data/mockData";

const CustomerMessages = () => {
  const { customer, coach } = useOutletContext();

  const customerThreads = useMemo(() => {
    if (!customer) return [];
    return threads.filter((thread) => {
      const matchesCustomer = thread.name.includes(customer.name);
      const matchesCoach = coach ? thread.name.includes(coach.name) : true;
      return matchesCustomer && matchesCoach;
    });
  }, [customer, coach]);

  const [activeThreadId, setActiveThreadId] = useState(customerThreads[0]?.id ?? "");
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setActiveThreadId((previous) => {
      if (customerThreads.some((thread) => thread.id === previous)) {
        return previous;
      }
      return customerThreads[0]?.id ?? "";
    });
  }, [customerThreads]);

  useEffect(() => {
    if (!activeThreadId) return;
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(timeout);
  }, [activeThreadId]);

  const messages = useMemo(() => threadMessages[activeThreadId] ?? [], [activeThreadId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Berichten</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Chat rechtstreeks met je coach{coach ? ` ${coach.name}` : ""}. Gebruik dit kanaal voor vragen en updates.
        </p>
      </header>

      {loading ? (
        <LoadingSpinner label="Berichten laden" />
      ) : (
        <ChatWindow
          threads={customerThreads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          messages={messages}
          draft={drafts[activeThreadId] ?? ""}
          onDraftChange={(value) =>
            setDrafts((prev) => ({ ...prev, [activeThreadId]: value }))
          }
          onSend={() => {
            alert("Mock bericht verzonden");
            setDrafts((prev) => ({ ...prev, [activeThreadId]: "" }));
          }}
          emptyLabel="Selecteer een gesprek of start een nieuwe conversatie"
        />
      )}
    </div>
  );
};

export default CustomerMessages;
