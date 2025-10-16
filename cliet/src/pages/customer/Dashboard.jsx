import React from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react";

const videoSections = [
  {
    title: "Introductie tot jouw traject",
    description: "Korte introductie over het EVC-proces en wat je mag verwachten.",
  },
  {
    title: "Aan de slag met je portfolio",
    description: "Stap voor stap uitleg over het toevoegen van bewijsstukken.",
  },
  {
    title: "Samenwerken met je coach",
    description: "Tips voor het plannen van contactmomenten en feedback.",
  },
];

const statusRows = [
  {
    label: "Opleidingen, diploma's en certificaten",
    status: "1 diploma",
    owner: "Jijzelf",
  },
  {
    label: "Relevante werkervaring",
    status: "1 werkervaring",
    owner: "Jijzelf",
  },
  {
    label: "Overige informatie en documenten",
    status: "7 items",
    owner: "Jijzelf",
  },
  {
    label: "Criteriumgericht interview",
    status: "Nog niet ingevuld",
    owner: "Traject Beheer",
  },
  {
    label: "Werkplekbezoek",
    status: "Nog niet ingevuld",
    owner: "Traject Beheer",
  },
];

const CustomerDashboard = () => {
  const { customer } = useOutletContext();
  const customerName = customer?.name?.split(" ")[0] || customer?.name || "kandidaat";
  const fullCustomerName = customer?.name || customerName;

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-evc-blue-200/40 bg-white shadow-sm">
        <div className="absolute -top-12 right-0 h-40 w-40 rounded-full bg-evc-blue-200/40 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-10 left-6 h-32 w-32 rounded-full bg-evc-blue-100/50 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 px-8 py-12 sm:px-12 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-evc-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Welkom
            </span>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Welkom {customerName} bij EVC Academie
            </h1>
            <div className="max-w-2xl space-y-3 text-base text-slate-600">
              <p>Welkom {fullCustomerName}</p>
              <p>Welkom bij EVC Academie!</p>
              <p>
                Dit is het portaal waarin jij de komende tijd aan de slag zult gaan met jouw EVC traject. Hieronder vind je een aantal
                instructievideo&apos;s die jou zullen helpen om zo goed mogelijk van start te kunnen gaan.
              </p>
              <p>Kijk alle video&apos;s en lees de handleiding goed door!</p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 font-medium">
                <ArrowRight className="h-4 w-4" />
                Bekijk de stappen van jouw traject
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 font-medium">
                <PlayCircle className="h-4 w-4" />
                Start met de uitlegvideo's hieronder
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Uitlegvideo's</h2>
            <p className="text-sm text-slate-500">Korte instructies om je snel op weg te helpen.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-evc-blue-200 px-4 py-2 text-sm font-medium text-evc-blue-700 transition hover:border-evc-blue-400 hover:text-evc-blue-900"
          >
            Externe videotheek
            <ArrowRight className="h-4 w-4" />
          </button>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {videoSections.map((video) => (
            <article
              key={video.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-evc-blue-500/5 via-transparent to-evc-blue-600/10 opacity-0 transition group-hover:opacity-100" />
              <div className="relative flex h-full flex-col gap-4 p-6">
                <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <PlayCircle className="h-12 w-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-slate-900">{video.title}</h3>
                  <p className="text-sm text-slate-500">{video.description}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-evc-blue-600 group-hover:text-evc-blue-700">
                  Video openen
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-900">Stand van zaken</h2>
          <p className="text-sm text-slate-500">Een momentopname van je voortgang en belangrijke aandachtspunten.</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-evc-blue-200 bg-evc-blue-50/60">
            <table className="min-w-full divide-y divide-evc-blue-200 text-sm text-evc-blue-900">
              <thead className="bg-evc-blue-100/60 text-left text-xs font-semibold uppercase tracking-[0.2em] text-evc-blue-700">
                <tr>
                  <th scope="col" className="px-4 py-3">Wat?</th>
                  <th scope="col" className="px-4 py-3">Stand van zaken</th>
                  <th scope="col" className="px-4 py-3">Door wie?</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map((row) => (
                  <tr key={row.label} className="odd:bg-white even:bg-evc-blue-50/50">
                    <td className="whitespace-pre-wrap px-4 py-3 font-medium text-slate-800">{row.label}</td>
                    <td className="px-4 py-3 text-slate-700">{row.status}</td>
                    <td className="px-4 py-3 text-slate-700">{row.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CustomerDashboard;
