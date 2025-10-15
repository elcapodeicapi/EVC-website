import React, { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import DataTable from "../../components/DataTable";

const Customers = () => {
  const { customers: customersFromContext = [] } = useOutletContext() ?? {};
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const customers = useMemo(() => {
    return customersFromContext.map((customer) => {
      let lastActivityLabel = "-";
      if (customer?.lastActivity instanceof Date) {
        lastActivityLabel = customer.lastActivity.toLocaleDateString();
      } else if (typeof customer?.lastActivity === "string" && customer.lastActivity.trim()) {
        lastActivityLabel = customer.lastActivity;
      }

      return {
        id: customer.id,
        name: customer.name || customer.email || "Onbekende klant",
        email: customer.email || "-",
        lastActivityLabel,
      };
    });
  }, [customersFromContext]);

  const filtered = useMemo(() => {
    if (!query) return customers;
    return customers.filter((customer) =>
      `${customer.name} ${customer.email}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [customers, query]);

  const columns = [
    { header: "Name", accessor: "name" },
    { header: "Email", accessor: "email" },
    { header: "Last Activity", accessor: "lastActivityLabel" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">My customers</h2>
          <p className="text-sm text-slate-500">Track progress and dive into each competency set.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers"
            className="h-10 w-full min-w-[220px] rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        dense
        renderActions={(row) => (
          <button
            type="button"
            onClick={() => navigate(`/coach/customers/${row.id}`)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-brand-500"
          >
            View details <ArrowRight className="h-3 w-3" />
          </button>
        )}
      />
    </div>
  );
};

export default Customers;
