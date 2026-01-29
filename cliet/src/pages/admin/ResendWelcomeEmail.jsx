import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Users as UsersIcon, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { get, post } from "../../lib/api";

const ROLE_LABELS = {
  customer: "Kandidaat",
  user: "Kandidaat",
  assessor: "Assessor",
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const StatusBanner = ({ status }) => {
  if (!status?.message) return null;
  const isError = status.type === "error";
  const Icon = isError ? XCircle : CheckCircle2;
  const color = isError
    ? "text-red-600 bg-red-50 border-red-200"
    : "text-emerald-600 bg-emerald-50 border-emerald-200";

  return (
    <div className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${color}`}>
      <Icon className="h-5 w-5" />
      <span>{status.message}</span>
    </div>
  );
};

export default function AdminResendWelcomeEmail() {
  const navigate = useNavigate();
  const query = useQuery();
  const preselectedUid = query.get("uid") || "";

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState(preselectedUid);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  const eligibleUsers = useMemo(() => {
    const allowed = new Set(["customer", "user", "assessor"]);
    return (Array.isArray(users) ? users : [])
      .map((u) => ({
        uid: u.id || u.uid || u.firebaseUid,
        email: u.email || "",
        name: u.name || "",
        role: String(u.role || "").toLowerCase(),
      }))
      .filter((u) => u.uid && allowed.has(u.role));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligibleUsers;
    return eligibleUsers.filter((u) =>
      `${u.name} ${u.email} ${ROLE_LABELS[u.role] || u.role}`.toLowerCase().includes(q)
    );
  }, [eligibleUsers, search]);

  const selectedUser = useMemo(
    () => eligibleUsers.find((u) => u.uid === selectedUid) || null,
    [eligibleUsers, selectedUid]
  );

  const passwordValid = useMemo(() => newPassword.trim().length >= 8, [newPassword]);
  const canSend = Boolean(selectedUid) && passwordValid && !sending;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingUsers(true);
      setUsersError(null);
      try {
        const data = await get("/auth/admin/users");
        if (!mounted) return;
        setUsers(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setUsersError(e?.message || "Kon gebruikers niet laden");
      } finally {
        if (!mounted) return;
        setLoadingUsers(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);

    if (!selectedUid) {
      setStatus({ type: "error", message: "Selecteer een gebruiker." });
      return;
    }
    if (!passwordValid) {
      setStatus({ type: "error", message: "Wachtwoord is ongeldig (minimaal 8 tekens)." });
      return;
    }

    setSending(true);
    try {
      await post(`/auth/admin/users/${selectedUid}/welcome-email`, { newPassword });
      setStatus({ type: "success", message: "Welkomstmail is verstuurd." });
      setNewPassword("");
      setShowPassword(false);
    } catch (e) {
      setStatus({ type: "error", message: e?.data?.error || e?.message || "Versturen mislukt" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Welkomstmail opnieuw versturen</h1>
          <p className="text-sm text-slate-500">
            Kies een kandidaat/assessor, stel een nieuw wachtwoord in en verstuur opnieuw de welkomstmail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/users")}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-600"
        >
          Terug naar gebruikers
        </button>
      </header>

      <StatusBanner status={status} />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Stuur nieuwe welkomstmail</h2>
            <p className="text-sm text-slate-500">Het wachtwoord dat je invult wordt het echte login-wachtwoord.</p>
          </div>
        </div>

        {usersError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Kon gebruikers niet laden: {usersError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="user-search">
              Zoek gebruiker
            </label>
            <input
              id="user-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op naam of e-mail"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="user-select">
              Gebruiker
            </label>
            <div className="relative">
              <UsersIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                id="user-select"
                value={selectedUid}
                onChange={(e) => setSelectedUid(e.target.value)}
                disabled={loadingUsers}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <option value="">Selecteer een kandidaat of assessor</option>
                {filteredUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {(u.name || u.email) + ` • ${ROLE_LABELS[u.role] || u.role}`}
                  </option>
                ))}
              </select>
            </div>
            {selectedUser ? (
              <p className="text-xs text-slate-400">
                Geselecteerd: <span className="font-semibold text-slate-600">{selectedUser.email}</span>
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="new-password">
              Nieuw wachtwoord
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimaal 8 tekens"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-12 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 hover:bg-slate-100"
                title={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!passwordValid && newPassword.length > 0 ? (
              <p className="text-xs text-red-600">Wachtwoord moet minimaal 8 tekens zijn.</p>
            ) : (
              <p className="text-xs text-slate-400">Dit wachtwoord wordt ingesteld in Firebase Auth en meegestuurd in de mail.</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Verstuur welkomstmail
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedUid(preselectedUid || "");
                setNewPassword("");
                setStatus(null);
              }}
              className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-600"
            >
              Reset
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
