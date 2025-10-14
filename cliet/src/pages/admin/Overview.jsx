import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeUsers } from "../../lib/firestoreAdmin";

const Overview = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeUsers(({ data, error: listenerError }) => {
      if (listenerError) {
        setError(listenerError);
        setLoading(false);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
      setError(null);
      setLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const formatRole = (role) => {
    if (!role) return "Onbekend";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const handleOpenCustomer = (user) => {
    if (!user || user.role !== "customer") return;
    navigate(`/coach/customers/${user.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Customer accounts</h1>
        <p className="mt-2 text-sm text-slate-500">
          Beheer klantprofielen en stap in hun omgeving om hun voortgang in te zien.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Kan accounts niet laden: {error.message || "Onbekende fout"}
        </div>
      ) : null}

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
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                  Accounts laden...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                  Nog geen accounts gevonden.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isCustomer = user.role === "customer";
                return (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{user.name || "Naam onbekend"}</td>
                    <td className="px-4 py-3">
                      {user.email ? (
                        <a href={`mailto:${user.email}`} className="text-brand-600 hover:text-brand-500">
                          {user.email}
                        </a>
                      ) : (
                        <span className="text-slate-400">Geen e-mail</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {formatRole(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenCustomer(user)}
                        disabled={!isCustomer}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
                          isCustomer
                            ? "bg-brand-600 text-white shadow-sm hover:bg-brand-500"
                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                        }`}
                      >
                        {isCustomer ? "Open as Customer" : "Alleen klanten"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Overview;
