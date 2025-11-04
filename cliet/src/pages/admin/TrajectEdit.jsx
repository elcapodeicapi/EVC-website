import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchUserDoc, fetchUsersByRole, updateCustomerTrajectory } from "../../lib/firestoreAdmin";
import { subscribeCustomerProfileDetails } from "../../lib/firestoreCustomer";
import LoadingSpinner from "../../components/LoadingSpinner";

const toYMD = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const daysLeft = (ymd) => {
  if (!ymd) return null;
  const today = new Date();
  const end = new Date(`${ymd}T00:00:00`);
  const ms = end.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

const TrajectEdit = () => {
  const navigate = useNavigate();
  const { userId } = useParams();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [details, setDetails] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const [form, setForm] = useState({
    coachId: "",
    assessorId: "",
    kwaliteitscoordinatorId: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) { setIsAdmin(false); return; }
      const u = JSON.parse(raw);
      const role = (u?.role || "").toLowerCase();
      setIsAdmin(role === "admin" || Boolean(u?.isAdmin));
    } catch (_) {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [u, coachList] = await Promise.all([
          fetchUserDoc(userId),
          fetchUsersByRole("coach"),
        ]);
        if (!active) return;
        setUser(u);
        setCoaches(Array.isArray(coachList) ? coachList : []);
      } catch (_) {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };
    if (userId) load();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return () => {};
    const unsub = subscribeCustomerProfileDetails(userId, ({ data }) => {
      setDetails(data || null);
    });
    return () => { if (typeof unsub === "function") unsub(); };
  }, [userId]);

  useEffect(() => {
    // Initialize form when sources load
    const evc = details?.evcTrajectory || {};
    const start = evc.startDate || toYMD(user?.evcStartDate) || "";
    const end = evc.endDate || toYMD(user?.evcEndDate) || "";
    const coachId = evc.coachId || user?.coachId || "";
    setForm((prev) => ({
      ...prev,
      coachId: coachId || "",
      assessorId: evc.assessorId || "",
      kwaliteitscoordinatorId: evc.kwaliteitscoordinatorId || "",
      startDate: start,
      endDate: end,
    }));
  }, [details, user]);

  const coachOptions = useMemo(() => coaches.map((c) => ({ id: c.id, label: c.name || c.email || c.id })), [coaches]);
  const remaining = useMemo(() => daysLeft(form.endDate), [form.endDate]);

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = async () => {
    if (!userId || !isAdmin) return;
    setSaving(true);
    setStatus(null);
    try {
      await updateCustomerTrajectory(userId, {
        coachId: form.coachId || null,
        assessorId: form.assessorId || null,
        kwaliteitscoordinatorId: form.kwaliteitscoordinatorId || null,
        startDate: form.startDate || "",
        endDate: form.endDate || "",
      });
      setStatus({ type: "success", message: "Wijzigingen opgeslagen" });
    } catch (err) {
      setStatus({ type: "error", message: err?.message || "Opslaan mislukt" });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Geen toegang. Deze pagina is alleen voor beheerders.
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner label="Gegevens laden" />;
  }

  const candidateName = user?.name || user?.email || userId;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">EVC-traject wijzigen</h1>
          <p className="mt-1 text-sm text-slate-500">Kandidaat: {candidateName}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
        >
          Terug
        </button>
      </header>

      {status ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${status.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {status.message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Begeleider koppelen</label>
            <select
              value={form.coachId}
              onChange={handleChange("coachId")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">— Geen —</option>
              {coachOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Assessor koppelen</label>
            <select
              value={form.assessorId}
              onChange={handleChange("assessorId")}
              disabled
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 shadow-inner"
            >
              <option value="">— Later beschikbaar —</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Kwaliteitscoördinator koppelen</label>
            <select
              value={form.kwaliteitscoordinatorId}
              onChange={handleChange("kwaliteitscoordinatorId")}
              disabled
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 shadow-inner"
            >
              <option value="">— Later beschikbaar —</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Startdatum</label>
            <input
              type="date"
              value={form.startDate}
              onChange={handleChange("startDate")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Einddatum</label>
            <input
              type="date"
              value={form.endDate}
              onChange={handleChange("endDate")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            {form.endDate ? (
              <p className="text-xs text-slate-500">{remaining != null ? (remaining >= 0 ? `${remaining} dagen resterend` : `${Math.abs(remaining)} dagen verlopen`) : ""}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
          >
            {saving ? "Opslaan..." : "Wijzigingen opslaan"}
          </button>
        </div>
      </section>
    </div>
  );
};

export default TrajectEdit;
