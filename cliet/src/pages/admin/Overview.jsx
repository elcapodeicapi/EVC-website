import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { adminUsers, customers } from "../../data/mockData";

const Overview = () => {
  const navigate = useNavigate();

  const customersByEmail = useMemo(() => {
    const map = new Map();
    customers.forEach((customer) => {
      map.set(customer.email, customer);
    });
    return map;
  }, []);

  const handleOpenCustomer = (user) => {
    const customer = customersByEmail.get(user.email);
    if (customer) {
      navigate(`/coach/customers/${customer.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Customer accounts</h1>
        <p className="mt-2 text-sm text-slate-500">
          Beheer klantprofielen en stap in hun omgeving om hun voortgang in te zien.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Naam
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                E-mail
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rol
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actie
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-600">
            {adminUsers.map((user) => {
              const customer = customersByEmail.get(user.email);
              const canOpen = user.role === "Customer" && customer;

              return (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${user.email}`} className="text-brand-600 hover:text-brand-500">
                      {user.email}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenCustomer(user)}
                      disabled={!canOpen}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
                        canOpen
                          ? "bg-brand-600 text-white shadow-sm hover:bg-brand-500"
                          : "cursor-not-allowed bg-slate-100 text-slate-400"
                      }`}
                    >
                      Open as Customer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Overview;
