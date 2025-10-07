import React from "react";
import StatsCard from "../../components/StatsCard";
import { coachStats, feedbackItems } from "../../data/mockData";

const CoachDashboard = () => {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-8 py-10 text-white shadow-card">
        <p className="text-sm uppercase tracking-[0.35em] text-white/70">Welcome back</p>
        <h2 className="mt-2 text-3xl font-semibold">Hi Isabelle, ready to coach?</h2>
        <p className="mt-3 max-w-2xl text-sm text-white/80">
          Review the latest uploads, leave actionable feedback, and keep your customers moving forward in their EVC journey.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-900">Today at a glance</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {coachStats.map((stat) => (
            <StatsCard key={stat.id} {...stat} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h3 className="text-base font-semibold text-slate-900">Recent feedback activity</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {feedbackItems.map((item) => (
            <article key={item.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{item.customer}</p>
                <p className="text-xs text-slate-500">{item.competency}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                <p className="text-sm font-medium text-slate-700">{item.summary}</p>
              </div>
              <div className="text-right text-xs text-slate-400">{item.updatedAt}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CoachDashboard;
