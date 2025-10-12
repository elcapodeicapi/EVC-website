import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, RefreshCcw } from "lucide-react";
import { get, post } from "../../lib/api";
import { uid } from "../../lib/utils";

const createCompetency = () => ({
  id: uid(),
  code: "",
  title: "",
  description: "",
});

const formatDate = (value) => {
  if (!value) return "-";
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return new Intl.DateTimeFormat("nl-NL", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch (error) {
    return "-";
  }
};

const AdminTrajects = () => {
  const [trajects, setTrajects] = useState([]);
  const [loadingTrajects, setLoadingTrajects] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    desiredOutcome: "",
    subjectKnowledge: "",
    behavioralComponents: "",
    competencies: [createCompetency()],
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const loadTrajects = useCallback(async () => {
    setLoadingTrajects(true);
    setLoadError(null);
    try {
      const data = await get("/trajects");
      setTrajects(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error.message || "Kon trajecten niet ophalen");
    } finally {
      setLoadingTrajects(false);
    }
  }, []);

  useEffect(() => {
    loadTrajects();
  }, [loadTrajects]);

  useEffect(() => {
    if (!saveSuccess && !saveError) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      setSaveSuccess(null);
      setSaveError(null);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [saveSuccess, saveError]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleCompetencyChange = (id, field, value) => {
    setForm((previous) => ({
      ...previous,
      competencies: previous.competencies.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleAddCompetency = () => {
    setForm((previous) => ({
      ...previous,
      competencies: [...previous.competencies, createCompetency()],
    }));
  };

  const handleRemoveCompetency = (id) => {
    setForm((previous) => {
      const nextCompetencies = previous.competencies.filter((item) => item.id !== id);
      return {
        ...previous,
        competencies: nextCompetencies.length > 0 ? nextCompetencies : [createCompetency()],
      };
    });
  };

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      desiredOutcome: "",
      subjectKnowledge: "",
      behavioralComponents: "",
      competencies: [createCompetency()],
    });
  };

  const validCompetencies = useMemo(
    () =>
      form.competencies
        .map((item, index) => ({ ...item, index }))
        .filter((item) => item.code.trim() || item.title.trim() || item.description.trim()),
    [form.competencies]
  );

  const canSubmit = useMemo(() => {
    if (saving) return false;
    if (!form.name.trim()) return false;
    if (!form.desiredOutcome.trim()) return false;
    if (!form.subjectKnowledge.trim()) return false;
    if (!form.behavioralComponents.trim()) return false;
    return validCompetencies.length > 0;
  }, [form.name, form.desiredOutcome, form.subjectKnowledge, form.behavioralComponents, saving, validCompetencies.length]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        desiredOutcome: form.desiredOutcome.trim(),
        subjectKnowledge: form.subjectKnowledge.trim(),
        behavioralComponents: form.behavioralComponents.trim(),
        competencies: validCompetencies.map((item) => ({
          code: item.code.trim(),
          title: item.title.trim() || item.code.trim() || `Competentie ${item.index + 1}`,
          body: item.description.trim(),
          order: item.index,
          tasks: [],
        })),
      };

      await post("/trajects", payload);
      setSaveSuccess("Nieuw traject opgeslagen");
      resetForm();
      await loadTrajects();
    } catch (error) {
      setSaveError(error.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Trajectbeheer</h1>
        <p className="mt-2 text-sm text-slate-500">
          Maak nieuwe trajecten aan en vul direct de standaardcompetenties in zodat coaches en deelnemers gelijk kunnen starten.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <label htmlFor="traject-name" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Trajectnaam
            </label>
            <input
              id="traject-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Bijvoorbeeld: Sociaal Werk Niveau 5"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="traject-description" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Beschrijving
            </label>
            <textarea
              id="traject-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Optioneel. Geef een korte toelichting voor coaches."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="traject-desired" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Gewenst resultaat
            </label>
            <textarea
              id="traject-desired"
              name="desiredOutcome"
              value={form.desiredOutcome}
              onChange={handleChange}
              rows={3}
              placeholder="Wat moet de deelnemer aantoonbaar kunnen na afronding?"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="traject-knowledge" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vakkennis en vaardigheden
            </label>
            <textarea
              id="traject-knowledge"
              name="subjectKnowledge"
              value={form.subjectKnowledge}
              onChange={handleChange}
              rows={3}
              placeholder="Beschrijf de noodzakelijke theorie en praktische skills."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="traject-behavior" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Gedragscomponenten
            </label>
            <textarea
              id="traject-behavior"
              name="behavioralComponents"
              value={form.behavioralComponents}
              onChange={handleChange}
              rows={3}
              placeholder="Welke houding en gedrag horen bij dit traject?"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Competenties</h2>
              <button
                type="button"
                onClick={handleAddCompetency}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" />
                Voeg competency toe
              </button>
            </div>

            {form.competencies.map((competency, index) => (
              <div key={competency.id} className="space-y-4 rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm font-semibold text-slate-700">Competentie {index + 1}</div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCompetency(competency.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-red-200 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Verwijder
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Code</label>
                    <input
                      value={competency.code}
                      onChange={(event) => handleCompetencyChange(competency.id, "code", event.target.value)}
                      placeholder="Bijv. B1-K1-W1"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Titel</label>
                    <input
                      value={competency.title}
                      onChange={(event) => handleCompetencyChange(competency.id, "title", event.target.value)}
                      placeholder="Korte titel"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Omschrijving</label>
                  <textarea
                    value={competency.description}
                    onChange={(event) => handleCompetencyChange(competency.id, "description", event.target.value)}
                    rows={3}
                    placeholder="Waar focust deze competentie op?"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>
            ))}
          </div>

          {(saveError || saveSuccess) && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                saveError
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-emerald-200 bg-emerald-50 text-emerald-600"
              }`}
            >
              {saveError || saveSuccess}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition ${
                canSubmit
                  ? "bg-brand-600 hover:bg-brand-500"
                  : "cursor-not-allowed bg-slate-300"
              }`}
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-600"
            >
              Reset
            </button>
          </div>
        </form>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Bestaande trajecten</h2>
              <p className="mt-1 text-sm text-slate-500">Overzicht uit Firestore</p>
            </div>
            <button
              type="button"
              onClick={loadTrajects}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand-400 hover:text-brand-600"
            >
              <RefreshCcw className="h-4 w-4" />
              Ververs
            </button>
          </div>

          {loadingTrajects ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Laden...</p>
          ) : loadError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</p>
          ) : trajects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
              Nog geen trajecten vastgelegd.
            </p>
          ) : (
            <ul className="space-y-3">
              {trajects.map((traject) => (
                <li key={traject.id} className="space-y-1 rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{traject.name}</p>
                      {traject.description ? (
                        <p className="text-sm text-slate-500">{traject.description}</p>
                      ) : null}
                      <div className="mt-2 space-y-1 text-sm text-slate-500">
                        {traject.desiredOutcome ? (
                          <p>
                            <span className="font-semibold text-slate-600">Gewenst resultaat: </span>
                            {traject.desiredOutcome}
                          </p>
                        ) : null}
                        {traject.subjectKnowledge ? (
                          <p>
                            <span className="font-semibold text-slate-600">Vakkennis & vaardigheden: </span>
                            {traject.subjectKnowledge}
                          </p>
                        ) : null}
                        {traject.behavioralComponents ? (
                          <p>
                            <span className="font-semibold text-slate-600">Gedragscomponenten: </span>
                            {traject.behavioralComponents}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {formatDate(traject.updatedAt || traject.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
};

export default AdminTrajects;
