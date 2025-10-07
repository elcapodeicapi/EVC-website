import React, { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { get, post, postForm } from "../lib/api";
import LegacyPageLayout from "./LegacyPageLayout";
import LoadingSpinner from "../components/LoadingSpinner";

const Evidence = () => {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", type: "", file: null });
  const [assign, setAssign] = useState({ taskId: "", evidenceId: "" });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  const loadEvidence = async () => {
    setLoading(true);
    setError("");
    try {
      const evidence = await get("/evidence");
      setList(evidence || []);
    } catch (err) {
      console.error("Failed to load evidence", err);
      setError("We konden de bewijsstukken niet ophalen. Probeer het later opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, []);

  const onUploadChange = (event) => {
    const { name, value, files } = event.target;
    setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const onUpload = async (event) => {
    event.preventDefault();
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("type", form.type);
    if (form.file) fd.append("file", form.file);

    setUploading(true);
    try {
      await postForm("/evidence/upload", fd);
      alert("✅ Evidence geüpload!");
      setForm({ name: "", type: "", file: null });
      await loadEvidence();
    } catch (e) {
      const message = e?.data?.error || e?.message || "Upload mislukt";
      alert("❌ Upload mislukt\n" + message);
    } finally {
      setUploading(false);
    }
  };

  const onAssignChange = (event) => {
    const { name, value } = event.target;
    setAssign((prev) => ({ ...prev, [name]: value }));
  };

  const onAssign = async (event) => {
    event.preventDefault();
    setAssigning(true);
    try {
      await post("/taskevidence/assign", assign);
      alert("✅ Evidence gekoppeld aan taak!");
    } catch (err) {
      alert("❌ Koppelen mislukt" + (err?.data?.error ? `\n${err.data.error}` : ""));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <LegacyPageLayout
      kicker="Bewijsstukken"
      title="Beheer je bewijs"
      description="Upload nieuwe bestanden en koppel ze eenvoudig aan de juiste taken."
      actions={[
        <button
          key="refresh"
          type="button"
          onClick={loadEvidence}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600"
        >
          Ververs
        </button>,
      ]}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner label="Bewijsstukken laden" />
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">{error}</div>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Nieuwe upload</h2>
                <p className="mt-1 text-sm text-slate-500">Geaccepteerde bestanden worden direct aan je bibliotheek toegevoegd.</p>
              </div>
            </header>
            <form onSubmit={onUpload} className="mt-6 space-y-4">
              <div className="grid gap-2">
                <label htmlFor="evidence-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Naam
                </label>
                <input
                  id="evidence-name"
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={onUploadChange}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="evidence-type" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Type
                </label>
                <input
                  id="evidence-type"
                  type="text"
                  name="type"
                  placeholder="bijvoorbeeld PDF, Foto"
                  value={form.type}
                  onChange={onUploadChange}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="evidence-file" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Bestand
                </label>
                <input
                  id="evidence-file"
                  type="file"
                  name="file"
                  required
                  onChange={onUploadChange}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
                >
                  {uploading ? "Bezig..." : "Uploaden"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Koppel aan taak</h2>
            <p className="mt-1 text-sm text-slate-500">
              Vul het taaknummer en het bewijsnummer in om de koppeling te maken.
            </p>
            <form onSubmit={onAssign} className="mt-6 space-y-4">
              <div className="grid gap-2">
                <label htmlFor="assign-task" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Taak ID
                </label>
                <input
                  id="assign-task"
                  type="number"
                  name="taskId"
                  required
                  value={assign.taskId}
                  onChange={onAssignChange}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="assign-evidence" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Bewijs ID
                </label>
                <input
                  id="assign-evidence"
                  type="number"
                  name="evidenceId"
                  required
                  value={assign.evidenceId}
                  onChange={onAssignChange}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={assigning}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {assigning ? "Bezig..." : "Koppelen"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <Paperclip className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Je uploads</h2>
              <p className="text-sm text-slate-500">Overzicht van alle bestanden die je eerder hebt toegevoegd.</p>
            </div>
          </div>
          {list.length > 0 ? (
            <ul className="mt-6 divide-y divide-slate-200 text-sm text-slate-600">
              {list.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{ev.name}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {ev.type || "onbekend"} · ID {ev.id}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : "-"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Je hebt nog geen bewijsstukken geüpload.
            </p>
          )}
        </section>
      ) : null}
    </LegacyPageLayout>
  );
};

export default Evidence;
