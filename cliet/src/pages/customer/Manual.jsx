import React from "react";

const CustomerManual = () => {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Handleiding</p>
        <h1 className="text-3xl font-semibold text-slate-900">Handleiding en veelgestelde vragen</h1>
        <p className="text-sm text-slate-500">
          Binnenkort vind je hier de volledige handleiding en antwoorden op veelgestelde vragen vanuit de EVC Academie.
          Tot die tijd kun je voor vragen contact opnemen met je begeleider.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm leading-relaxed text-slate-600">
          De uitgebreide stappenplannen, voorbeelden en checklists worden momenteel bijgewerkt. Zodra deze beschikbaar zijn, vind je ze op deze
          pagina terug zodat je zelfstandig aan de slag kunt met je EVC-traject.
        </p>
      </section>
    </div>
  );
};

export default CustomerManual;
