import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Save } from "lucide-react";

const ambitionInitial = "Bedenk hoe je hoopt dat jouw loopbaan er de komende jaren uit gaat zien. Wat wil je nog bereiken in je werk? Wat wil je leren, of wat wil je nooit meer doen? Denk hier even goed over na, want dit zijn vaak moeilijke vragen.";
const motivationInitial = "Bedenk naast jouw algemene ambitie, waarom je specifiek aan dit EVC-traject meedoet en wat je er van hoopt en verwacht.";

const CustomerCareerGoal = () => {
  const { customer } = useOutletContext();
  const [ambition, setAmbition] = useState(ambitionInitial);
  const [motivation, setMotivation] = useState(motivationInitial);

  const displayName = customer?.name || "kandidaat";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Mijn loopbaandoel</p>
        <h1 className="text-3xl font-semibold text-slate-900">Jouw ambitie in kaart</h1>
        <div className="max-w-2xl space-y-3 text-sm text-slate-500">
          <p>
            <strong className="font-semibold text-slate-700">Ambitie: wat wil je nog bereiken?</strong>
          </p>
          <p>{ambitionInitial}</p>
          <p>
            <strong className="font-semibold text-slate-700">Motivatie: wat verwacht je van dit traject?</strong>
          </p>
          <p>{motivationInitial}</p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Voor {displayName}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Beschrijf je ambitie: welke stappen wil je zetten binnen je loopbaan?
          </p>
          <textarea
            value={ambition}
            onChange={(event) => setAmbition(event.target.value)}
            rows={8}
            className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
          />
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Motivatie</h2>
          <p className="mt-2 text-sm text-slate-500">
            Waarom kies je voor dit traject en wat wil je laten zien?
          </p>
          <textarea
            value={motivation}
            onChange={(event) => setMotivation(event.target.value)}
            rows={8}
            className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
          />
        </article>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-evc-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-evc-blue-500"
        >
          <Save className="h-4 w-4" />
          Tijdelijk opslaan
        </button>
      </div>
    </div>
  );
};

export default CustomerCareerGoal;
