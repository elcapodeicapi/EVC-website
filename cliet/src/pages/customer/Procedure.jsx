import React from "react";
import { Link } from "react-router-dom";

const customerLinks = [
  { to: "/customer/dashboard", label: "Dashboard" },
  { to: "/customer/portfolio", label: "Mijn portfolio" },
  { to: "/customer/contact", label: "Contact" },
];

const Procedure = () => {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Hoe werkt jouw EVC-traject?</h1>
        <p className="mt-2 text-sm text-slate-500">
          Volg onderstaande stappen en gebruik de links om snel naar de belangrijkste onderdelen te gaan.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {customerLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-600"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        <p>
          Hier komt later informatie over het stappenplan, belangrijke deadlines, en tips voor het verzamelen van bewijsstukken.
        </p>
        <p className="mt-3">
          Voor nu kun je alvast de andere pagina&apos;s verkennen via de buttons hierboven.
        </p>
      </section>
    </div>
  );
};

export default Procedure;
