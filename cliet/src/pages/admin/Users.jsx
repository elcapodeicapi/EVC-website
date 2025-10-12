import React, { useEffect, useMemo, useState } from "react";
import { Users as UsersIcon, UserPlus, CheckCircle2, XCircle } from "lucide-react";
import { get, post } from "../../lib/api";

const ROLE_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "coach", label: "Coach" },
  { value: "admin", label: "Admin" },
];

const initialFormState = {
  name: "",
  email: "",
  password: "",
  role: "customer",
  trajectId: "",
};

const StatusBanner = ({ status }) => {
  if (!status?.message) return null;
  const isError = status.type === "error";
  const Icon = isError ? XCircle : CheckCircle2;
  const color = isError ? "text-red-600 bg-red-50 border-red-200" : "text-emerald-600 bg-emerald-50 border-emerald-200";

  return (
    <div className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${color}`}>
      <Icon className="h-5 w-5" />
      <span>{status.message}</span>
    </div>
  );
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [trajects, setTrajects] = useState([]);
  const [loadingTrajects, setLoadingTrajects] = useState(false);
  const trajectLookup = useMemo(() => {
    const map = new Map();
    trajects.forEach((traject) => {
      map.set(traject.id, traject);
    });
    return map;
  }, [trajects]);

  const loadUsers = async () => {
    setFetching(true);
    try {
      const data = await get("/auth/admin/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Kon gebruikers niet laden" });
    } finally {
      setFetching(false);
    }
  };

  const loadTrajects = async () => {
    setLoadingTrajects(true);
    try {
      const data = await get("/trajects");
      const list = Array.isArray(data) ? data : [];
      setTrajects(list);
      setForm((prev) => ({ ...prev, trajectId: list[0]?.id || "" }));
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Kon trajecten niet laden" });
    } finally {
      setLoadingTrajects(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadTrajects();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "role") {
        if (value === "customer") {
          const defaultTraject = trajects[0]?.id || prev.trajectId || "";
          return { ...prev, role: value, trajectId: defaultTraject };
        }
        return { ...prev, role: value };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        trajectId: form.role === "customer" ? form.trajectId : null,
      };
      await post("/auth/admin/users", body);
      setStatus({ type: "success", message: "Account aangemaakt" });
      setForm({ ...initialFormState, trajectId: trajects[0]?.id || "" });
      await loadUsers();
    } catch (error) {
      setStatus({ type: "error", message: error?.data?.error || error?.message || "Aanmaken mislukt" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Beheer gebruikers</h1>
          <p className="text-sm text-slate-500">Maak nieuwe accounts voor coaches en deelnemers.</p>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 sm:flex">
          <UsersIcon className="h-4 w-4" />
          <span>{users.length} actieve gebruikers</span>
        </div>
      </header>

      <StatusBanner status={status} />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nieuw account</h2>
              <p className="text-sm text-slate-500">Voer de gegevens in en kies de juiste rol.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-2">
              <label htmlFor="user-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Volledige naam
              </label>
              <input
                id="user-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="Bijvoorbeeld: Kim de Vries"
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="user-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                E-mail
              </label>
              <input
                id="user-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="jij@voorbeeld.nl"
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="user-password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Tijdelijk wachtwoord
              </label>
              <input
                id="user-password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="Minimaal 8 tekens"
                required
              />
              <p className="text-xs text-slate-400">De gebruiker kan dit wachtwoord later wijzigen.</p>
            </div>
            <div className="grid gap-2">
              <label htmlFor="user-role" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Rol
              </label>
              <select
                id="user-role"
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
            {form.role === "customer" ? (
              <div className="grid gap-2">
                <label htmlFor="user-traject" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Traject
                </label>
                <select
                  id="user-traject"
                  name="trajectId"
                  value={form.trajectId}
                  onChange={handleChange}
                  disabled={loadingTrajects || trajects.length === 0}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:text-slate-400"
                  required
                >
                  {trajects.length === 0 ? <option value="">Geen trajecten beschikbaar</option> : null}
                  {trajects.map((traject) => (
                    <option key={traject.id} value={traject.id}>
                      {traject.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Wijs deze deelnemer aan een traject toe. Dit bepaalt welke competenties zichtbaar zijn.
                </p>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
            >
              {loading ? "Account aanmaken..." : "Account aanmaken"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Bestaande gebruikers</h2>
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              {fetching ? "Bezig met laden..." : "Laatste update"}
            </span>
          </div>
          <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-2">
            {users.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Nog geen gebruikers gevonden. Voeg de eerste toe via het formulier hiernaast.
              </p>
            ) : (
              users.map((user) => (
                <article
                  key={user.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{user.name || "Naam onbekend"}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    {user.trajectId ? (
                      <p className="text-xs text-slate-400">
                        Traject: {trajectLookup.get(user.trajectId)?.name || user.trajectId}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {user.role}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminUsers;
