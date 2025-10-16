import React from "react";

const CustomerWorkplaceVisit = () => {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Werkplekbezoek</p>
        <h1 className="text-3xl font-semibold text-slate-900">Voorbereiding werkplekbezoek</h1>
        <p className="text-sm text-slate-500">
          Onderdeel van je EVC-traject kan een bezoek aan je werkplek door de assessor zijn. De assessor komt dan kijken op je werkplek en heeft een
          gesprek met jou over je werk, hoe je dingen aanpakt, je ervaringen en jouw ambities.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm leading-relaxed text-slate-600">
          Je vindt hieronder het verslag van het werkplekbezoek wanneer het gesprek is geweest en de assessor hier een gespreksverslag over heeft
          geschreven.
        </p>
      </section>
    </div>
  );
};

export default CustomerWorkplaceVisit;
