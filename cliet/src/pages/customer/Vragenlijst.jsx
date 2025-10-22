import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CircleHelp } from "lucide-react";
import {
  saveCustomerQuestionnaireResponses,
  subscribeCustomerQuestionnaire,
} from "../../lib/firestoreCustomer";
import {
  QUESTIONNAIRE_SECTIONS,
  QUESTIONNAIRE_SECTION_IDS,
  emptyQuestionnaireResponses,
  normalizeQuestionnaireResponses,
  questionnaireIsComplete,
} from "../../lib/questionnaire";

const STORAGE_NAMESPACE = "evc-vragenlijst-responses";

const StatusBanner = ({ state, className = "" }) => {
  if (!state) return null;
  const tone = state.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const label = state.type === "error" ? "Opslaan mislukt" : "Opgeslagen";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${tone} ${className}`.trim()}>
      <span className="font-semibold">{label}</span>
      <span className="text-xs text-current/80">{state.message}</span>
    </div>
  );
};

const CustomerVragenlijst = () => {
  const { customer } = useOutletContext() ?? {};
  const customerId = customer?.firebaseUid || customer?.id || customer?.uid || null;
  const storageKey = useMemo(() => (customerId ? `${STORAGE_NAMESPACE}:${customerId}` : null), [customerId]);

  const [responses, setResponses] = useState(() => emptyQuestionnaireResponses());
  const [status, setStatus] = useState(null);
  const [remoteRecord, setRemoteRecord] = useState(null);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setResponses((previous) => ({ ...previous, ...parsed }));
      }
    } catch (_) {
      // Ignored: fall back to defaults when parsing fails.
    }
  }, [storageKey]);

  const handleChange = (sectionId) => (event) => {
    const { value } = event.target;
    setResponses((previous) => ({ ...previous, [sectionId]: value }));
    setStatus(null);
    setIsDirty(true);
  };

  useEffect(() => {
    if (!customerId) {
      setRemoteRecord(null);
      setRemoteLoading(false);
      return () => {};
    }

    let active = true;
    setRemoteLoading(true);

    const unsubscribe = subscribeCustomerQuestionnaire(customerId, ({ data, error }) => {
      if (!active) return;
      if (error) {
        setStatus({ type: "error", message: error?.message || "Kon vragenlijst niet laden." });
        setRemoteLoading(false);
        return;
      }
      setRemoteRecord(data || null);
      setRemoteLoading(false);
      if (!isDirty && data?.responses) {
        setResponses((previous) => ({ ...previous, ...normalizeQuestionnaireResponses(data.responses) }));
      }
    });

    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customerId, isDirty]);

  useEffect(() => {
    if (!remoteRecord?.responses) return;
    if (isDirty) return;
    const normalizedRemote = normalizeQuestionnaireResponses(remoteRecord.responses);
    setResponses((previous) => {
      const differs = QUESTIONNAIRE_SECTION_IDS.some((sectionId) => {
        const left = typeof previous?.[sectionId] === "string" ? previous[sectionId] : "";
        const right = normalizedRemote[sectionId] || "";
        return left !== right;
      });
      return differs ? normalizedRemote : previous;
    });
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalizedRemote));
    } catch (_) {
      // ignore storage errors
    }
  }, [remoteRecord, isDirty, storageKey]);

  const handleSave = async () => {
    if (!storageKey) {
      setStatus({ type: "error", message: "Log opnieuw in om uw antwoorden op te slaan." });
      return;
    }
    if (!customerId) {
      setStatus({ type: "error", message: "Kon geen kandidaat-id vinden." });
      return;
    }
    const normalized = normalizeQuestionnaireResponses(responses);
    const isComplete = questionnaireIsComplete(normalized);
    try {
      setSaving(true);
      await saveCustomerQuestionnaireResponses(customerId, normalized, {
        updatedBy: customerId,
        lastEditedBy: customerId,
      });
      localStorage.setItem(storageKey, JSON.stringify(normalized));
      const now = new Date();
      setRemoteRecord((previous) => ({
        ...(previous || {}),
        responses: normalized,
        completed: isComplete,
        updatedAt: now,
        completedAt: isComplete ? now : previous?.completedAt || null,
        updatedBy: customerId,
        lastEditedBy: customerId,
      }));
      setStatus({ type: "success", message: "Uw antwoorden zijn opgeslagen in het dossier." });
      setIsDirty(false);
    } catch (error) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(normalized));
      } catch (_) {
        // ignore storage errors
      }
      setStatus({
        type: "error",
        message: error?.message || "Opslaan mislukt. Uw antwoorden zijn lokaal opgeslagen op dit apparaat.",
      });
    } finally {
      setSaving(false);
    }
  };

  const remoteUpdatedAt = remoteRecord?.updatedAt instanceof Date ? remoteRecord.updatedAt : remoteRecord?.updatedAt ? new Date(remoteRecord.updatedAt) : null;
  const remoteSummary = (() => {
    if (!remoteRecord) return null;
    const completed = remoteRecord.completed || questionnaireIsComplete(remoteRecord.responses);
    if (completed) return "Compleet ingevuld";
    const filledCount = QUESTIONNAIRE_SECTION_IDS.filter((sectionId) => {
      const value = remoteRecord.responses?.[sectionId];
      return typeof value === "string" && value.trim().length > 0;
    }).length;
    return filledCount > 0 ? `${filledCount} van ${QUESTIONNAIRE_SECTION_IDS.length} onderwerpen ingevuld` : "Nog niet ingevuld";
  })();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Loopbaan en Burgerschap</p>
        <h1 className="text-3xl font-semibold text-slate-900">Reflecties op uw loopbaan en burgerschap</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Gebruik deze vragenlijst om uw ervaringen en inzichten te delen. Geef bij iedere vraag concrete voorbeelden uit uw dagelijks leven zodat uw begeleider uw situatie goed kan beoordelen. U kunt uw antwoorden tussentijds opslaan en later verder aanvullen.
        </p>
      </header>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Opslagstatus</p>
        <p>
          {remoteLoading
            ? "Gegevens uit het dossier worden geladen..."
            : remoteSummary || "Nog geen gegevens opgeslagen in het dossier."}
        </p>
        {remoteUpdatedAt ? (
          <p className="mt-1 text-[11px] text-slate-400">
            Laatst bijgewerkt op {remoteUpdatedAt.toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        ) : null}
      </div>
      <section className="space-y-6">
        {QUESTIONNAIRE_SECTIONS.map((section) => (
          <article key={section.id} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{section.instruction}</p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-evc-blue-200 hover:text-evc-blue-600"
                aria-label="Toon toelichting"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={responses[section.id] || ""}
              onChange={handleChange(section.id)}
              rows={6}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
              placeholder="Schrijf uw antwoord hier..."
            />
          </article>
        ))}
      </section>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-full bg-evc-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-evc-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
        <StatusBanner state={status} className="w-full sm:w-auto" />
      </div>
      <p className="text-xs text-slate-400">
        Antwoorden worden opgeslagen in uw dossier en op dit apparaat voor snel hergebruik.
      </p>
    </div>
  );
};

export default CustomerVragenlijst;
