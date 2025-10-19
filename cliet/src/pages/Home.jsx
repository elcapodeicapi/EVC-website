import React from "react";
import { Link } from "react-router-dom";
import LegacyPageLayout from "./LegacyPageLayout";

const Home = () => {
  return (
    <LegacyPageLayout showHeader={false}>
      <section className="flex min-h-[70vh] items-center justify-center">
        <div className="grid w-full max-w-5xl gap-10 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-2xl sm:p-10 lg:grid-cols-2">
          <div className="flex flex-col justify-between rounded-3xl bg-brand-50/60 p-8 shadow-inner">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-500">EVC platform</p>
                <h1 className="mt-3 text-2xl font-semibold text-slate-900">Welkom bij EVC Portal</h1>
              </div>
              <form className="space-y-5" noValidate>
                <div className="space-y-2">
                  <label htmlFor="login-username" className="text-sm font-medium text-slate-700">
                    Gebruikersnaam
                  </label>
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="jouw@gebruikersnaam.nl"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
                    Wachtwoord
                  </label>
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:ring-offset-2"
                  >
                    Inloggen
                  </button>
                  <Link
                    to="/password-reset"
                    className="text-center text-xs font-semibold text-amber-500 transition hover:text-amber-400"
                  >
                    Wachtwoord vergeten?
                  </Link>
                </div>
              </form>
            </div>
            <p className="mt-10 text-xs text-slate-500">
              Problemen met inloggen? Neem contact op met jouw coach of beheerder.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-6 rounded-3xl bg-white p-2 text-slate-600">
            <div className="space-y-4">
              <p className="text-base leading-relaxed text-slate-700">
                Een EVC-traject via EVC Portal leidt tot een helder en duidelijk beeld van je mogelijkheden.
              </p>
              <p className="text-base leading-relaxed text-slate-700">
                Onder leiding van onze deskundige begeleiders stel je online je portfolio samen. Dit portfolio
                bevat een scala aan bewijzen, welke worden beoordeeld door een vakbekwaam assessor.
              </p>
              <p className="text-base leading-relaxed text-slate-700">
                Het hieruit voortkomende advies voor erkenning van de eerder opgedane competenties wordt
                geformuleerd in een landelijk erkend ervaringscertificaat.
              </p>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-sm text-slate-600 shadow-sm">
              <p className="font-semibold text-slate-800">Waarom EVC Portal?</p>
              <p className="mt-2 leading-relaxed">
                Een moderne, veilige en gebruiksvriendelijke omgeving waarmee jij en je coach inzicht houden in
                iedere stap van het traject.
              </p>
            </div>
          </div>
        </div>
      </section>
    </LegacyPageLayout>
  );
};

export default Home;
