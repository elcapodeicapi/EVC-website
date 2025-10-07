import React, { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Paperclip, MessageCircle, CheckCircle2 } from "lucide-react";
import { customerCompetencies } from "../../data/mockData";

const CustomerPlanning = () => {
  const { customer, coach } = useOutletContext();

  const competencies = useMemo(() => {
    if (!customer) return [];
    return customerCompetencies[customer.id] ?? [];
  }, [customer]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Planning</p>
        <h1 className="text-3xl font-semibold text-slate-900">Jouw competenties en bewijsstukken</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Bekijk welke competenties onderdeel zijn van je traject en voeg eenvoudig nieuwe bewijsstukken toe.
          {coach ? ` Je coach ${coach.name} kijkt mee en geeft feedback.` : ""}
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        {competencies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-400">
            Er zijn nog geen competenties gekoppeld aan jouw traject.
          </div>
        ) : (
          competencies.map((item, index) => (
            <article key={`${item.competency}-${index}`} className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Competentie</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{item.competency}</h2>
                  <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
                  <CheckCircle2 className="h-4 w-4" /> Actief
                </span>
              </div>

              <div className="space-y-3 rounded-2xl bg-slate-50 px-4 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploads ({item.uploads.length})</h3>
                {item.uploads.length === 0 ? (
                  <p className="text-sm text-slate-400">Nog geen bestanden. Klik op "Voeg upload toe" om te starten.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-600">
                    {item.uploads.map((upload) => (
                      <li key={upload} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm">
                        <Paperclip className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{upload}</span>
                        <button
                          type="button"
                          className="ml-auto text-xs font-semibold text-brand-600 hover:text-brand-500"
                        >
                          Download
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-300 px-3 py-2 text-xs font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50"
                >
                  <Paperclip className="h-4 w-4" /> Voeg upload toe
                </button>
              </div>

              <div className="flex items-center gap-2 rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-500 shadow-inner">
                <MessageCircle className="h-4 w-4 text-brand-500" />
                <span className="leading-relaxed">
                  Heb je vragen? Laat een bericht achter bij je coach in het berichtenoverzicht.
                </span>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
};

export default CustomerPlanning;
