import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, LayoutDashboard, Users } from "lucide-react";
import LegacyPageLayout from "./LegacyPageLayout";

const features = [
  "Je portfolio opbouwen met duidelijke stappen",
  "Bewijsstukken veilig uploaden en beheren",
  "Berichten sturen naar coaches en begeleiders",
  "Voortgang bijhouden via planning en taken",
];

const Home = () => {
  return (
    <LegacyPageLayout showHeader={false}>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 text-white shadow-xl">
        <div className="grid gap-10 px-8 py-16 sm:px-12 lg:grid-cols-2 lg:px-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-white/60">EVC platform</p>
            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Welkom bij jouw EVC portfolio
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">
              Werk stap voor stap naar je erkenning toe. Verzamel bewijsstukken, werk samen met je coach en houd alles op één plek bij.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-brand-600 shadow-lg shadow-brand-900/10 transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                Naar login
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white/80">
                Nieuwe accounts? Neem contact op met het EVC-team
              </span>
            </div>
          </div>
          <div className="relative isolate">
            <div className="absolute -top-10 right-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-brand-200/40 blur-3xl" aria-hidden="true" />
            <div className="relative rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur">
              <h2 className="text-xl font-semibold text-white">Alles in één vertrouwde omgeving</h2>
              <ul className="mt-6 space-y-4">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-white/85">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-white" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Voor kandidaten</h3>
          <p className="mt-3 text-sm text-slate-500">
            Werk op je eigen tempo aan opdrachten, voeg reflecties toe en beheer bewijsstukken.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Voor coaches</h3>
          <p className="mt-3 text-sm text-slate-500">
            Krijg realtime inzicht in voortgang, geef feedback en begeleid kandidaten gericht.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Veilig en transparant</h3>
          <p className="mt-3 text-sm text-slate-500">
            Bewaar bestanden veilig en werk samen in een omgeving met duidelijke rollen en rechten.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Link
          to="/admin"
          className="group flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-400 hover:shadow-lg"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Bekijk de admin-ervaring</h3>
            <p className="mt-2 text-sm text-slate-500">
              Navigeer naar het beheerdersdashboard met klantoverzicht en toewijzingen.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
              Naar admin-dashboard
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>

        <Link
          to="/coach"
          className="group flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-400 hover:shadow-lg"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Ervaar het coachportaal</h3>
            <p className="mt-2 text-sm text-slate-500">
              Ga direct naar het coachdashboard met klantkaarten, feedback en berichten.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
              Naar coach-dashboard
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      </section>
    </LegacyPageLayout>
  );
};

export default Home;
