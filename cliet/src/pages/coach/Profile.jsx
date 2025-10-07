import React from "react";
import { coachProfile } from "../../data/mockData";

const CoachProfile = () => {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-8 py-10 text-white shadow-card">
        <p className="text-sm uppercase tracking-[0.35em] text-white/70">Coach profile</p>
        <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-3xl font-semibold">{coachProfile.name}</h2>
            <p className="mt-2 text-white/80">{coachProfile.role}</p>
            <p className="mt-3 max-w-2xl text-sm text-white/70">{coachProfile.bio}</p>
          </div>
          <dl className="grid grid-cols-3 gap-4">
            {coachProfile.performance.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-white/10 px-4 py-3 text-center shadow-inner backdrop-blur"
              >
                <dt className="text-xs uppercase tracking-[0.3em] text-white/70">{item.label}</dt>
                <dd className="mt-2 text-2xl font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <article className="rounded-3xl bg-white p-6 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Contactgegevens</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">E-mail</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{coachProfile.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Telefoon</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{coachProfile.phone}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Locatie</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{coachProfile.location}</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Expertisegebieden</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {coachProfile.expertise.map((area) => (
                <li
                  key={area}
                  className="rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700"
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Beschikbaarheid</h3>
          <ul className="mt-4 space-y-3">
            {coachProfile.availability.map((slot) => (
              <li
                key={`${slot.day}-${slot.slots}`}
                className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 text-sm text-slate-700"
              >
                <span className="font-medium text-slate-900">{slot.day}</span>
                <span>{slot.slots}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h3 className="text-base font-semibold text-slate-900">Aankomende sessies</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {coachProfile.upcomingSessions.map((session) => (
            <article
              key={session.id}
              className="rounded-2xl border border-slate-100 p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900">{session.customer}</p>
              <p className="text-xs text-slate-500">{session.date}</p>
              <p className="mt-3 text-sm text-slate-600">{session.focus}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CoachProfile;
