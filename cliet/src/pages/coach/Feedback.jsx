import React, { useMemo } from "react";
import { useOutletContext } from "react-router-dom";

const Feedback = () => {
  const { feedback = [], customers = [] } = useOutletContext() ?? {};

  const entries = useMemo(() => {
    const customerIndex = new Map(customers.map((customer) => [customer.id, customer]));
    return [...feedback]
      .map((item) => {
        const customer = customerIndex.get(item.customerId) || {};
        const customerName = item.customerName || customer.name || customer.email || "Onbekende klant";
        const updatedAt = item.updatedAt instanceof Date ? item.updatedAt : null;
        const updatedAtLabel = updatedAt ? updatedAt.toLocaleString() : "";
        return {
          id: item.id,
          customerName,
          competencyLabel: item.competencyId || "Competentie",
          summary: item.summary || item.content || "-",
          updatedAt,
          updatedAtLabel,
        };
      })
      .sort((a, b) => {
        const valueA = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
        const valueB = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
        return valueB - valueA;
      });
  }, [customers, feedback]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Feedback queue</h2>
        <p className="text-sm text-slate-500">Keep track of open reviews and recently submitted guidance.</p>
      </div>
      <div className="overflow-hidden rounded-3xl bg-white shadow-card">
        {entries.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-slate-500">Nog geen feedback geregistreerd.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-6 py-4 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{item.customerName}</p>
                  <p className="text-xs text-slate-500">{item.competencyLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Feedback</p>
                  <p className="font-medium text-slate-700">{item.summary}</p>
                </div>
                <span className="text-xs text-slate-400">{item.updatedAtLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Feedback;
