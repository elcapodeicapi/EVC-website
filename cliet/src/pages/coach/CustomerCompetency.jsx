import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Save } from "lucide-react";
import clsx from "clsx";
import { customers, customerCompetencies } from "../../data/mockData";

const CustomerCompetency = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const customer = customers.find((item) => item.id === customerId);
  const competencies = useMemo(() => customerCompetencies[customerId] ?? [], [customerId]);
  const [expanded, setExpanded] = useState(competencies.map((_, index) => index === 0));
  const [draftFeedback, setDraftFeedback] = useState({});

  const toggle = (index) => {
    setExpanded((prev) => prev.map((value, idx) => (idx === index ? !value : value)));
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </button>

      <header className="rounded-3xl bg-white p-6 shadow-card">
        <p className="text-xs uppercase tracking-wide text-slate-400">Customer dossier</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{customer?.name ?? "Unknown"}</h2>
        <p className="mt-1 text-sm text-slate-500">{customer?.email}</p>
      </header>

      <section className="space-y-4">
        {competencies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
            No competencies recorded yet.
          </div>
        ) : (
          competencies.map((item, index) => {
            const isOpen = expanded[index];
            return (
              <article key={item.competency} className="overflow-hidden rounded-3xl bg-white shadow-card">
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Competency</p>
                    <h3 className="text-lg font-semibold text-slate-900">{item.competency}</h3>
                    <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                  </div>
                  {isOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </button>
                <div
                  className={clsx(
                    "grid grid-cols-1 gap-6 border-t border-slate-100 px-6 transition-all duration-200 lg:grid-cols-[2fr,1fr]",
                    isOpen ? "max-h-[520px] py-6" : "max-h-0 overflow-hidden"
                  )}
                >
                  <div className="space-y-4 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Uploads</p>
                      <ul className="mt-2 space-y-2">
                        {item.uploads.map((file) => (
                          <li key={file} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2">
                            <span>{file}</span>
                            <button className="text-xs font-medium text-brand-600 hover:text-brand-500">Preview</button>
                          </li>
                        ))}
                        {item.uploads.length === 0 ? (
                          <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
                            No uploads yet.
                          </li>
                        ) : null}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Past feedback</p>
                      <ul className="mt-2 space-y-3">
                        {item.feedback.map((entry) => (
                          <li key={entry.id} className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
                            “{entry.body}” — {entry.author}
                          </li>
                        ))}
                        {item.feedback.length === 0 ? (
                          <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
                            No feedback captured yet.
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                  <form
                    className="flex h-full flex-col rounded-3xl bg-slate-50 p-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      alert("Mock save feedback");
                      setDraftFeedback((prev) => ({ ...prev, [item.competency]: "" }));
                    }}
                  >
                    <p className="text-sm font-medium text-slate-700">Add feedback</p>
                    <textarea
                      rows={6}
                      value={draftFeedback[item.competency] ?? ""}
                      onChange={(event) =>
                        setDraftFeedback((prev) => ({ ...prev, [item.competency]: event.target.value }))
                      }
                      placeholder="Highlight strengths, note improvements, and suggest next steps."
                      className="mt-2 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                    <button
                      type="submit"
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-500"
                    >
                      <Save className="h-4 w-4" /> Save feedback
                    </button>
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
};

export default CustomerCompetency;
