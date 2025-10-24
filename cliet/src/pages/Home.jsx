import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import LegacyPageLayout from "./LegacyPageLayout";
import BrandLogo from "../components/BrandLogo";
import { post } from "../lib/api";
import { auth } from "../firebase";

const Home = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const credentials = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credentials.user.getIdToken();
      const data = await post("/auth/login/firebase", { idToken });
      if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
      const redirectPath = data.redirectPath || "/dashboard";
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err?.data?.error || err?.message || "Inloggen is niet gelukt. Controleer je gegevens.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LegacyPageLayout showHeader={false} showNavbar={false}>
      <section className="flex min-h-[70vh] items-center justify-center">
        <div className="grid w-full max-w-5xl gap-10 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-2xl sm:p-10 lg:grid-cols-2">
          <div className="flex flex-col justify-between rounded-3xl bg-brand-50/60 p-8 shadow-inner">
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-3">
                <BrandLogo className="mx-auto" tone="light" />
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-500">EVC-platform</p>
                <h1 className="mt-3 text-2xl font-semibold text-slate-900">Welkom bij het EVC-portaal</h1>
              </div>
              <form className="space-y-5" noValidate onSubmit={handleSubmit}>
                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label htmlFor="home-login-email" className="text-sm font-medium text-slate-700">
                    E-mail
                  </label>
                  <input
                    id="home-login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="jij@voorbeeld.nl"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="home-login-password" className="text-sm font-medium text-slate-700">
                    Wachtwoord
                  </label>
                  <input
                    id="home-login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    required
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-300"
                  >
                    {loading ? "Bezig met inloggen..." : "Inloggen"}
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
              Problemen met inloggen? Neem contact op met jouw begeleider of beheerder.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-6 rounded-3xl bg-white p-2 text-slate-600">
            <div className="space-y-4">
              <p className="text-base leading-relaxed text-slate-700">
                Een EVC-traject via het EVC-portaal leidt tot een helder en duidelijk beeld van je mogelijkheden.
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
              <p className="font-semibold text-slate-800">Waarom het EVC-portaal?</p>
              <p className="mt-2 leading-relaxed">
                Een moderne, veilige en gebruiksvriendelijke omgeving waarmee jij en je begeleider inzicht houden in
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
