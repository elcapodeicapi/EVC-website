import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Save } from "lucide-react";
import clsx from "clsx";
import LoadingSpinner from "../../components/LoadingSpinner";
import { subscribeTrajectCompetencies, subscribeCustomerUploads } from "../../lib/firestoreCustomer";
import { addCoachFeedback, subscribeCustomerFeedback } from "../../lib/firestoreCoach";

const CustomerCompetency = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { customers = [], coach } = useOutletContext() ?? {};

  const customer = useMemo(
    () => customers.find((item) => item.id === customerId) || null,
    [customers, customerId]
  );

  const [competencies, setCompetencies] = useState([]);
  const [competenciesLoading, setCompetenciesLoading] = useState(false);
  const [competenciesError, setCompetenciesError] = useState(null);

  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsError, setUploadsError] = useState(null);

  const [customerFeedback, setCustomerFeedback] = useState([]);
  const [customerFeedbackLoading, setCustomerFeedbackLoading] = useState(false);
  const [customerFeedbackError, setCustomerFeedbackError] = useState(null);

  const [draftFeedback, setDraftFeedback] = useState({});
  const [submissionState, setSubmissionState] = useState({});
  const [expanded, setExpanded] = useState([]);

  useEffect(() => {
    if (!customer?.trajectId) {
      setCompetencies([]);
      setCompetenciesError(null);
      setCompetenciesLoading(false);
      return () => {};
    }
    setCompetenciesLoading(true);
    const unsubscribe = subscribeTrajectCompetencies(customer.trajectId, ({ data, error }) => {
      setCompetencies(Array.isArray(data) ? data : []);
      setCompetenciesError(error || null);
      setCompetenciesLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customer?.trajectId]);

  useEffect(() => {
    if (!customer?.id) {
      setUploads([]);
      setUploadsError(null);
      setUploadsLoading(false);
      return () => {};
    }
    setUploadsLoading(true);
    const unsubscribe = subscribeCustomerUploads(customer.id, ({ uploads: uploadDocs, error }) => {
      setUploads(Array.isArray(uploadDocs) ? uploadDocs : []);
      setUploadsError(error || null);
      setUploadsLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customer?.id]);

  useEffect(() => {
    if (!customer?.id) {
      setCustomerFeedback([]);
      setCustomerFeedbackError(null);
      setCustomerFeedbackLoading(false);
      return () => {};
    }
    setCustomerFeedbackLoading(true);
    const unsubscribe = subscribeCustomerFeedback(customer.id, ({ data, error }) => {
      setCustomerFeedback(Array.isArray(data) ? data : []);
      setCustomerFeedbackError(error || null);
      setCustomerFeedbackLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customer?.id]);

  const sections = useMemo(() => {
    return competencies.map((competency) => {
      const uploadsForCompetency = uploads
        .filter((upload) => upload.competencyId === competency.id)
        .sort((a, b) => {
          const timeA = a.uploadedAt instanceof Date ? a.uploadedAt.getTime() : 0;
          const timeB = b.uploadedAt instanceof Date ? b.uploadedAt.getTime() : 0;
          return timeB - timeA;
        });
      const feedbackForCompetency = customerFeedback
        .filter((entry) => entry.competencyId === competency.id)
        .sort((a, b) => {
          const timeA = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
          const timeB = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
          return timeB - timeA;
        });

      const titleParts = [];
      if (competency.code) titleParts.push(competency.code);
      if (competency.title) titleParts.push(competency.title);

      return {
        id: competency.id,
        title: titleParts.length > 0 ? titleParts.join(" • ") : competency.title || competency.code || "Competentie",
        description: competency.description || competency.desiredOutcome || "",
        uploads: uploadsForCompetency,
        feedback: feedbackForCompetency,
      };
    });
  }, [competencies, customerFeedback, uploads]);

  useEffect(() => {
    setExpanded((previous) => {
      if (previous.length === sections.length) return previous;
      return sections.map((_, index) => index === 0);
    });
  }, [sections.length]);

  const isLoading = competenciesLoading || uploadsLoading || customerFeedbackLoading;
  const errorMessage =
    competenciesError?.message || uploadsError?.message || customerFeedbackError?.message || null;

  const toggle = (index) => {
    setExpanded((prev) => prev.map((value, idx) => (idx === index ? !value : value)));
  };

  const handleSubmitFeedback = async (section) => {
    const text = (draftFeedback[section.id] || "").trim();
    if (!text) {
      setSubmissionState((prev) => ({
        ...prev,
        [section.id]: { status: "error", message: "Voer feedback in" },
      }));
      return;
    }
    if (!coach?.id || !customer?.id) {
      setSubmissionState((prev) => ({
        ...prev,
        [section.id]: { status: "error", message: "Informatie ontbreekt" },
      }));
      return;
    }
    setSubmissionState((prev) => ({
      ...prev,
      [section.id]: { status: "saving" },
    }));
    try {
      await addCoachFeedback({
        coachId: coach.id,
        coachName: coach.name || coach.email || "Coach",
        customerId: customer.id,
        customerName: customer.name || customer.email || "",
        competencyId: section.id,
        body: text,
      });
      setDraftFeedback((prev) => ({ ...prev, [section.id]: "" }));
      setSubmissionState((prev) => ({
        ...prev,
        [section.id]: { status: "success", message: "Feedback opgeslagen" },
      }));
    } catch (error) {
      setSubmissionState((prev) => ({
        ...prev,
        [section.id]: { status: "error", message: error.message || "Opslaan mislukt" },
      }));
    }
  };

  if (!customer) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-500"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar klanten
        </button>
        <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
          Klant niet gevonden.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar klanten
      </button>

      <header className="rounded-3xl bg-white p-6 shadow-card">
        <p className="text-xs uppercase tracking-wide text-slate-400">Klantdossier</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{customer.name || "Onbekend"}</h2>
        <p className="mt-1 text-sm text-slate-500">{customer.email || "Geen e-mail"}</p>
      </header>

      {isLoading ? (
        <LoadingSpinner label="Gegevens laden" />
      ) : (
        <section className="space-y-4">
          {errorMessage ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
          {sections.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
              Nog geen competenties beschikbaar voor deze klant.
            </div>
          ) : (
            sections.map((section, index) => {
              const isOpen = expanded[index];
              const state = submissionState[section.id] || { status: "idle" };
              return (
                <article key={section.id} className="overflow-hidden rounded-3xl bg-white shadow-card">
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Competentie</p>
                      <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{section.description || "Geen beschrijving"}</p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </button>
                  <div
                    className={clsx(
                      "grid grid-cols-1 gap-6 border-t border-slate-100 px-6 transition-all duration-200 lg:grid-cols-[2fr,1fr]",
                      isOpen ? "max-h-[560px] py-6" : "max-h-0 overflow-hidden"
                    )}
                  >
                    <div className="space-y-4 text-sm text-slate-600">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Uploads</p>
                        <ul className="mt-2 space-y-2">
                          {section.uploads.map((upload) => {
                            const uploadLabel = upload.uploadedAt instanceof Date ? upload.uploadedAt.toLocaleDateString() : "";
                            return (
                              <li key={upload.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2">
                                <span>
                                  {upload.displayName || upload.name || upload.fileName || "Bestand"}
                                  {uploadLabel ? <span className="ml-2 text-xs text-slate-400">{uploadLabel}</span> : null}
                                </span>
                                {upload.downloadURL ? (
                                  <a
                                    href={upload.downloadURL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-brand-600 hover:text-brand-500"
                                  >
                                    Bekijken
                                  </a>
                                ) : null}
                              </li>
                            );
                          })}
                          {section.uploads.length === 0 ? (
                            <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
                              Nog geen uploads.
                            </li>
                          ) : null}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Eerdere feedback</p>
                        <ul className="mt-2 space-y-3">
                          {section.feedback.map((entry) => {
                            const updatedLabel = entry.updatedAt instanceof Date ? entry.updatedAt.toLocaleString() : "";
                            return (
                              <li key={entry.id} className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
                                <p className="font-medium text-slate-800">{entry.coachName || coach?.name || "Coach"}</p>
                                <p className="mt-1 whitespace-pre-line">{entry.content || entry.summary || "-"}</p>
                                {updatedLabel ? (
                                  <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">{updatedLabel}</p>
                                ) : null}
                              </li>
                            );
                          })}
                          {section.feedback.length === 0 ? (
                            <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
                              Nog geen feedback vastgelegd.
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    </div>
                    <form
                      className="flex h-full flex-col rounded-3xl bg-slate-50 p-5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleSubmitFeedback(section);
                      }}
                    >
                      <p className="text-sm font-medium text-slate-700">Nieuwe feedback</p>
                      <textarea
                        rows={6}
                        value={draftFeedback[section.id] ?? ""}
                        onChange={(event) =>
                          setDraftFeedback((prev) => ({ ...prev, [section.id]: event.target.value }))
                        }
                        placeholder="Beschrijf observaties, geef complimenten, en noteer vervolgstappen."
                        className="mt-2 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      />
                      {state.status === "error" && state.message ? (
                        <p className="mt-2 text-xs text-rose-600">{state.message}</p>
                      ) : null}
                      {state.status === "success" && state.message ? (
                        <p className="mt-2 text-xs text-emerald-600">{state.message}</p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={state.status === "saving"}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-500 disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" /> {state.status === "saving" ? "Opslaan…" : "Sla feedback op"}
                      </button>
                    </form>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}
    </div>
  );
};

export default CustomerCompetency;
