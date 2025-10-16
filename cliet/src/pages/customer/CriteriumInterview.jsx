import React from "react";

const CustomerCriteriumInterview = () => {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Criteriumgericht interview</p>
        <h1 className="text-3xl font-semibold text-slate-900">Voorbereiding criteriumgericht interview</h1>
        <p className="text-sm text-slate-500">
          Na afloop van het criteriumgericht interview schrijft de assessor een kort gespreksverslag.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm leading-relaxed text-slate-600">
          Dit vind je op deze pagina zodra jouw assessor deze heeft toegevoegd.
        </p>
      </section>
    </div>
  );
};

export default CustomerCriteriumInterview;
