import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { NotebookPen } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import { saveCoachCustomerNote, subscribeCoachCustomerNote } from "../../lib/firestoreCoach";

const formatTimestamp = (value) => {
  if (!(value instanceof Date)) return null;
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
};

const AantekeningenOverzicht = () => {
  const { coach, customers: customersFromContext = [] } = useOutletContext() ?? {};

  const coachId = coach?.id || coach?.firebaseUid || coach?.uid || null;
  const customers = useMemo(() => {
    return [...customersFromContext].sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
  }, [customersFromContext]);

  const [selectedCustomerId, setSelectedCustomerId] = useState(() => customers[0]?.id || null);
  const [noteRecord, setNoteRecord] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (!customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0]?.id || null);
    }
  }, [customers, selectedCustomerId]);

  useEffect(() => {
    setStatus(null);
    setError(null);
    setNoteRecord(null);
    if (!coachId || !selectedCustomerId) {
      setNoteDraft("");
      return () => {};
    }

    setLoading(true);
    const unsubscribe = subscribeCoachCustomerNote(coachId, selectedCustomerId, ({ data, error: noteError }) => {
      if (noteError) {
        setError(noteError);
        setLoading(false);
        return;
      }
      setError(null);
      setNoteRecord(data);
      if (!isDirtyRef.current) {
        setNoteDraft(data?.text || "");
      }
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      isDirtyRef.current = false;
    };
  }, [coachId, selectedCustomerId]);

  const handleDraftChange = (event) => {
    setNoteDraft(event.target.value);
    isDirtyRef.current = true;
    setStatus(null);
  };

  const handleSave = async () => {
    if (!coachId || !selectedCustomerId) return;
    setSaving(true);
    setStatus({ type: "info", message: "Opslaan..." });
    try {
      await saveCoachCustomerNote({
        coachId,
        customerId: selectedCustomerId,
        text: noteDraft,
        existingTimestamp: noteRecord?.timestamp || null,
      });
      isDirtyRef.current = false;
      setStatus({ type: "success", message: "Notitie opgeslagen" });
    } catch (saveError) {
      setStatus({ type: "error", message: saveError.message || "Opslaan mislukt" });
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || null;
  const lastEditedLabel = formatTimestamp(noteRecord?.lastEdited || noteRecord?.timestamp || null);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-brand-600">Aantekeningenoverzicht</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
            <NotebookPen className="h-5 w-5 text-brand-600" />
            Persoonlijke notities per kandidaat
          </h2>
          <p className="text-sm text-slate-500">
            Bewaar observaties en afspraken. Alles wordt realtime gesynchroniseerd met Firestore.
          </p>
        </div>
        {customers.length > 0 ? (
          <select
            value={selectedCustomerId || ""}
            onChange={(event) => {
              setSelectedCustomerId(event.target.value || null);
              isDirtyRef.current = false;
            }}
            className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name || customer.email || "Kandidaat"}
              </option>
            ))}
          </select>
        ) : null}
      </header>

      {customers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
          Je hebt nog geen kandidaten om notities voor te maken.
        </div>
      ) : (
        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-card">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Kandidaat</p>
              <h3 className="text-lg font-semibold text-slate-900">{selectedCustomer?.name || selectedCustomer?.email}</h3>
              <p className="text-sm text-slate-500">
                {selectedCustomer?.trajectName || selectedCustomer?.trajectTitle || "Traject onbekend"}
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {lastEditedLabel ? `Laatst bewerkt: ${lastEditedLabel}` : "Nog niet opgeslagen"}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error.message || "Kon de notitie niet laden."}
            </div>
          ) : null}

          {loading ? (
            <LoadingSpinner label="Notitie laden" />
          ) : (
            <div className="space-y-4">
              <textarea
                value={noteDraft}
                onChange={handleDraftChange}
                placeholder="Schrijf hier je observaties, follow-up taken of aandachtspunten."
                rows={12}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  {status?.type === "error"
                    ? <span className="text-rose-600">{status.message}</span>
                    : status?.type === "success"
                    ? <span className="text-emerald-600">{status.message}</span>
                    : status?.type === "info"
                    ? <span className="text-slate-500">{status.message}</span>
                    : null}
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isDirtyRef.current}
                  className="inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
                >
                  {saving ? "Opslaan..." : "Bewaar notitie"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AantekeningenOverzicht;
