import React, { useEffect, useMemo, useState } from "react";
import { createAssignment, subscribeAssignments, subscribeUsers } from "../../lib/firestoreAdmin";

const Assignments = () => {
  const [customers, setCustomers] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ customerId: "", coachId: "" });
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState(null);
  const [errors, setErrors] = useState({ customers: null, coaches: null, assignments: null });

  useEffect(() => {
    const unsubscribeCustomers = subscribeUsers(({ data, error }) => {
      if (error) {
        setErrors((prev) => ({ ...prev, customers: error }));
        setLoadingCustomers(false);
        return;
      }
      setErrors((prev) => ({ ...prev, customers: null }));
      setCustomers(Array.isArray(data) ? data : []);
      setLoadingCustomers(false);
    }, { roles: ["customer"] });

    const unsubscribeCoaches = subscribeUsers(({ data, error }) => {
      if (error) {
        setErrors((prev) => ({ ...prev, coaches: error }));
        setLoadingCoaches(false);
        return;
      }
      setErrors((prev) => ({ ...prev, coaches: null }));
      setCoaches(Array.isArray(data) ? data : []);
      setLoadingCoaches(false);
    }, { roles: ["coach"] });

    const unsubscribeAssignments = subscribeAssignments(({ data, error }) => {
      if (error) {
        setErrors((prev) => ({ ...prev, assignments: error }));
        setLoadingAssignments(false);
        return;
      }
      setErrors((prev) => ({ ...prev, assignments: null }));
      setEntries(Array.isArray(data) ? data : []);
      setLoadingAssignments(false);
    });

    return () => {
      if (typeof unsubscribeCustomers === "function") unsubscribeCustomers();
      if (typeof unsubscribeCoaches === "function") unsubscribeCoaches();
      if (typeof unsubscribeAssignments === "function") unsubscribeAssignments();
    };
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      customerId: prev.customerId || customers[0]?.id || "",
    }));
  }, [customers]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      coachId: prev.coachId || coaches[0]?.id || "",
    }));
  }, [coaches]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleAssign = (event) => {
    event.preventDefault();
    if (!form.customerId || !form.coachId) {
      setStatus({ type: "error", message: "Selecteer zowel een klant als een coach." });
      return;
    }
    setCreating(true);
    setStatus(null);
    createAssignment({ customerId: form.customerId, coachId: form.coachId })
      .then(() => {
        setStatus({ type: "success", message: "Toewijzing opgeslagen." });
      })
      .catch((error) => {
        setStatus({ type: "error", message: error?.message || "Toewijzing mislukt." });
      })
      .finally(() => {
        setCreating(false);
      });
  };

  const userLookup = useMemo(() => {
    const map = new Map();
    customers.forEach((customer) => map.set(customer.id, customer));
    coaches.forEach((coach) => map.set(coach.id, coach));
    return map;
  }, [customers, coaches]);

  const renderStatusBanner = () => {
    if (!status) return null;
    const isError = status.type === "error";
    const tone = isError
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
    return (
      <div className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>
        {status.message}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Assignments</h1>
        <p className="mt-2 text-sm text-slate-500">Pair customers with their coaches and keep the overview tidy.</p>
      </div>

      {renderStatusBanner()}

      <form onSubmit={handleAssign} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4 sm:items-end">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</label>
          <select
            name="customerId"
            value={form.customerId}
            onChange={handleChange}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            disabled={loadingCustomers || customers.length === 0}
          >
            {loadingCustomers ? <option value="">Laden...</option> : null}
            {!loadingCustomers && customers.length === 0 ? <option value="">Geen klanten beschikbaar</option> : null}
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name || customer.email}
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
            disabled={loadingCoaches || coaches.length === 0}
          >
            {loadingCoaches ? <option value="">Laden...</option> : null}
            {!loadingCoaches && coaches.length === 0 ? <option value="">Geen coaches beschikbaar</option> : null}
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name || coach.email}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <button
            type="submit"
            disabled={creating || !form.customerId || !form.coachId}
            className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
          >
            {creating ? "Bezig..." : "Assign"}
          </button>
        </div>
      </form>

      {errors.customers ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Klanten konden niet geladen worden: {errors.customers.message || "Onbekende fout"}
        </div>
      ) : null}
      {errors.coaches ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Coaches konden niet geladen worden: {errors.coaches.message || "Onbekende fout"}
        </div>
      ) : null}
      {errors.assignments ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Toewijzingen konden niet geladen worden: {errors.assignments.message || "Onbekende fout"}
        </div>
      ) : null}

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
            {loadingAssignments ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                  Toewijzingen laden...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                  No assignments yet.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {userLookup.get(entry.customerId)?.name || userLookup.get(entry.customerId)?.email || "Onbekende klant"}
                  </td>
                  <td className="px-4 py-3">
                    {userLookup.get(entry.coachId)?.name || userLookup.get(entry.coachId)?.email || "Onbekende coach"}
                  </td>
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
