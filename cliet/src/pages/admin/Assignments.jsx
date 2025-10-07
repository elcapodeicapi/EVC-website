import React, { useState } from "react";
import { uid } from "../../lib/utils";
import { assignments as seedAssignments, customers, coaches } from "../../data/mockData";

const Assignments = () => {
  const initialCustomerId = customers[0]?.id ?? "";
  const initialCoachId = coaches[0]?.id ?? "";

  const [entries, setEntries] = useState(seedAssignments);
  const [form, setForm] = useState({ customerId: initialCustomerId, coachId: initialCoachId });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleAssign = (event) => {
    event.preventDefault();
    const customer = customers.find((item) => item.id === form.customerId);
    const coach = coaches.find((item) => item.id === form.coachId);
    if (!customer || !coach) {
      return;
    }

    setEntries((previous) => [
      ...previous,
      {
        id: uid(),
        customer: customer.name,
        coach: coach.name,
        status: "Pending",
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Assignments</h1>
        <p className="mt-2 text-sm text-slate-500">Pair customers with their coaches and keep the overview tidy.</p>
      </div>

      <form onSubmit={handleAssign} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4 sm:items-end">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</label>
          <select
            name="customerId"
            value={form.customerId}
            onChange={handleChange}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coach</label>
          <select
            name="coachId"
            value={form.coachId}
            onChange={handleChange}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
          >
            Assign
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Coach</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-600">
            {entries.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                  No assignments yet.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{entry.customer}</td>
                  <td className="px-4 py-3">{entry.coach}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Assignments;
