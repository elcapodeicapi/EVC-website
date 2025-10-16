import React, { useState } from "react";
import { UserPlus } from "lucide-react";
import LegacyPageLayout from "./LegacyPageLayout";

const ROLE_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "coach", label: "Coach" },
  { value: "admin", label: "Admin" },
];

const TestCreateAccount = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "customer" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      };
      const API_BASE = import.meta.env.VITE_API_BASE || "";
      const response = await fetch(`${API_BASE}/auth/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";
      let responseData = null;
      if (contentType.includes("application/json")) {
        try {
          responseData = await response.json();
        } catch (_) {
          responseData = null;
        }
      } else {
        try {
          responseData = await response.text();
        } catch (_) {
          responseData = null;
        }
      }

      if (!response.ok) {
        const message =
          (responseData && responseData.error) ||
          (typeof responseData === "string" && responseData) ||
          response.statusText ||
          "Aanmaken mislukt";
        const error = new Error(message);
        error.status = response.status;
        error.data = responseData;
        throw error;
      }

      setStatus({ type: "success", message: "Account aangemaakt" });
      setForm({ name: "", email: "", password: "", role: "customer" });
    } catch (error) {
      const message = error?.data?.error || error?.message || "Aanmaken mislukt";
      setStatus({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LegacyPageLayout
      kicker="Testing"
      title="Test account aanmaken"
  description="Gebruik dit formulier om snel een account aan te maken via de admin endpoint. In development kun je dit gebruiken zonder in te loggen (zet ALLOW_DEV_ACCOUNT_CREATION=true op de backend)."
    >
      <section className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Nieuwe gebruiker</h2>
            <p className="text-sm text-slate-500">Deze testpagina maakt direct een account aan zonder ingelogd te zijn.</p>
          </div>
        </div>

        {status?.message ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              status.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {status.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-2">
            <label htmlFor="test-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Naam
            </label>
            <input
              id="test-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Bijv. Daniël Vermeer"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="test-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              E-mail
            </label>
            <input
              id="test-email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="jij@voorbeeld.nl"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="test-password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Tijdelijk wachtwoord
            </label>
            <input
              id="test-password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Minimaal 8 tekens"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="test-role" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Rol
            </label>
            <select
              id="test-role"
              name="role"
              value={form.role}
              onChange={handleChange}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
          >
            {loading ? "Bezig..." : "Account aanmaken"}
          </button>
        </form>
      </section>
    </LegacyPageLayout>
  );
};

export default TestCreateAccount;
