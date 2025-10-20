import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { get, post, put } from "../../lib/api";
import { uid } from "../../lib/utils";

const createCompetency = () => ({
  id: uid(),
  code: "",
  title: "",
  description: "",
  desiredOutcome: "",
  subjectKnowledge: "",
  behavioralComponents: "",
});

const createCompetencyGroup = () => ({
  id: uid(),
  code: "",
  title: "",
  competencies: [createCompetency()],
});

const createEmptyForm = () => ({
  id: null,
  name: "",
  description: "",
  competencyGroups: [createCompetencyGroup()],
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

const sanitizeGroupFromDetail = (group, fallbackOrder = 0) => ({
  id: uid(),
  code: group?.code || "",
  title: group?.title || "",
  order: group?.order ?? fallbackOrder,
  competencies: Array.isArray(group?.competencies) && group.competencies.length > 0
    ? [...group.competencies]
        .sort((a, b) => (a?.order ?? a?.competencyOrder ?? 0) - (b?.order ?? b?.competencyOrder ?? 0))
        .map((competency) => ({
          id: uid(),
          code: competency?.code || "",
          title: competency?.title || "",
          description: competency?.description || "",
          desiredOutcome: competency?.desiredOutcome || "",
          subjectKnowledge: competency?.subjectKnowledge || "",
          behavioralComponents: competency?.behavioralComponents || "",
        }))
    : [createCompetency()],
});

const AdminTrajects = () => {
  const [trajects, setTrajects] = useState([]);
  const [loadingTrajects, setLoadingTrajects] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [selectedTrajectId, setSelectedTrajectId] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [form, setForm] = useState(createEmptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const isEditing = Boolean(form.id);
  const formDisabled = saving || loadingDetail;

  const loadTrajects = useCallback(async () => {
    setLoadingTrajects(true);
    setLoadError(null);
    try {
      const data = await get("/trajects");
      const list = Array.isArray(data) ? data : [];
      setTrajects(list);
      return list;
    } catch (error) {
      const message = error?.message || "Kon trajecten niet ophalen";
      setLoadError(message);
      setTrajects([]);
      return [];
    } finally {
      setLoadingTrajects(false);
    }
  }, []);

  const resetToNewForm = useCallback(() => {
    setSelectedTrajectId(null);
    setForm(createEmptyForm());
    setDetailError(null);
    setSaveError(null);
    setSaveSuccess(null);
  }, []);

  const loadTrajectDetail = useCallback(async (id) => {
    if (!id) return;
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const data = await get(`/trajects/${id}`);
      const groups = Array.isArray(data?.competencyGroups) ? data.competencyGroups : [];
      const sanitizedGroups = groups
        .map((group, index) => sanitizeGroupFromDetail(group, index))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(({ order, ...rest }) => rest);

      setForm({
        id: data?.id || id,
        name: data?.name || "",
        description: data?.description || "",
        competencyGroups: sanitizedGroups.length > 0 ? sanitizedGroups : [createCompetencyGroup()],
      });
      setSelectedTrajectId(id);
    } catch (error) {
      const message = error?.message || "Kon traject niet laden";
      setDetailError(message);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadTrajects();
  }, [loadTrajects]);

  useEffect(() => {
    if (!saveSuccess && !saveError) {
      return () => {};
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

  const handleGroupChange = (groupId, field, value) => {
    setForm((previous) => ({
      ...previous,
      competencyGroups: previous.competencyGroups.map((group) =>
        group.id === groupId ? { ...group, [field]: value } : group
      ),
    }));
  };

  const handleAddGroup = () => {
    if (formDisabled) return;
    setForm((previous) => ({
      ...previous,
      competencyGroups: [...previous.competencyGroups, createCompetencyGroup()],
    }));
  };

  const handleRemoveGroup = (groupId) => {
    if (formDisabled) return;
    setForm((previous) => {
      const remaining = previous.competencyGroups.filter((group) => group.id !== groupId);
      return {
        ...previous,
        competencyGroups: remaining.length > 0 ? remaining : [createCompetencyGroup()],
      };
    });
  };

  const handleCompetencyChange = (groupId, competencyId, field, value) => {
    setForm((previous) => ({
      ...previous,
      competencyGroups: previous.competencyGroups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          competencies: group.competencies.map((competency) =>
            competency.id === competencyId ? { ...competency, [field]: value } : competency
          ),
        };
      }),
    }));
  };

  const handleAddCompetency = (groupId) => {
    if (formDisabled) return;
    setForm((previous) => ({
      ...previous,
      competencyGroups: previous.competencyGroups.map((group) =>
        group.id === groupId
          ? { ...group, competencies: [...group.competencies, createCompetency()] }
          : group
      ),
    }));
  };

  const handleRemoveCompetency = (groupId, competencyId) => {
    if (formDisabled) return;
    setForm((previous) => ({
      ...previous,
      competencyGroups: previous.competencyGroups.map((group) => {
        if (group.id !== groupId) return group;
        const remaining = group.competencies.filter((competency) => competency.id !== competencyId);
        return {
          ...group,
          competencies: remaining.length > 0 ? remaining : [createCompetency()],
        };
      }),
    }));
  };

  const groupsForSubmission = useMemo(() => {
    return form.competencyGroups
      .map((group, groupIndex) => {
        const trimmedCode = group.code.trim();
        const trimmedTitle = group.title.trim();
        const competencies = group.competencies
          .map((competency, competencyIndex) => {
            const trimmed = {
              code: competency.code.trim(),
              title: competency.title.trim(),
              description: competency.description.trim(),
              desiredOutcome: competency.desiredOutcome.trim(),
              subjectKnowledge: competency.subjectKnowledge.trim(),
              behavioralComponents: competency.behavioralComponents.trim(),
            };
            const hasContent = Object.values(trimmed).some((value) => value.length > 0);
            if (!hasContent) {
              return null;
            }
            return {
              ...trimmed,
              rawId: competency.id,
              groupId: group.id,
              competencyIndex,
            };
          })
          .filter(Boolean);

        return {
          id: group.id,
          groupIndex,
          trimmedCode,
          trimmedTitle,
          competencies,
        };
      })
      .filter((group) => group.trimmedCode || group.trimmedTitle || group.competencies.length > 0);
  }, [form.competencyGroups]);

  const hasInvalidGroup = useMemo(
    () => groupsForSubmission.some((group) => !group.trimmedCode || !group.trimmedTitle),
    [groupsForSubmission]
  );

  const hasInvalidCompetency = useMemo(
    () =>
      groupsForSubmission.some((group) =>
        group.competencies.some(
          (competency) =>
            !competency.code ||
            !competency.title ||
            !competency.desiredOutcome ||
            !competency.subjectKnowledge ||
            !competency.behavioralComponents
        )
      ),
    [groupsForSubmission]
  );

  const groupsWithCompetencies = useMemo(
    () => groupsForSubmission.filter((group) => group.competencies.length > 0),
    [groupsForSubmission]
  );

  const canSubmit = useMemo(() => {
    if (formDisabled) return false;
    if (!form.name.trim()) return false;
    if (groupsWithCompetencies.length === 0) return false;
    if (hasInvalidGroup || hasInvalidCompetency) return false;
    return true;
  }, [formDisabled, form.name, groupsWithCompetencies, hasInvalidGroup, hasInvalidCompetency]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      competencyGroups: groupsWithCompetencies.map((group, groupIndex) => ({
        code: group.trimmedCode,
        title: group.trimmedTitle,
        order: groupIndex,
        competencies: group.competencies.map((competency, competencyIndex) => ({
          code: competency.code,
          title: competency.title,
          description: competency.description,
          desiredOutcome: competency.desiredOutcome,
          subjectKnowledge: competency.subjectKnowledge,
          behavioralComponents: competency.behavioralComponents,
          order: competencyIndex,
        })),
      })),
    };

    try {
      if (isEditing) {
        await put(`/trajects/${form.id}`, payload);
        setSaveSuccess("Traject bijgewerkt");
        await loadTrajects();
        await loadTrajectDetail(form.id);
      } else {
        const created = await post("/trajects", payload);
        setSaveSuccess("Nieuw traject opgeslagen");
        const list = await loadTrajects();
        const newId = created?.id || list.find((item) => item.name === payload.name)?.id || null;
        if (newId) {
          await loadTrajectDetail(newId);
        } else {
          resetToNewForm();
        }
      }
    } catch (error) {
      setSaveError(error?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const selectedTraject = useMemo(
    () => trajects.find((item) => item.id === selectedTrajectId) || null,
    [trajects, selectedTrajectId]
  );

  const totalCompetencyCount = groupsWithCompetencies.reduce(
    (total, group) => total + group.competencies.length,
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Trajectbeheer</h1>
        <p className="mt-2 text-sm text-slate-500">
          Maak nieuwe trajecten aan of bewerk bestaande trajecten en competenties. Wijzigingen zijn direct zichtbaar voor kandidaten en begeleiders.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="relative space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {loadingDetail && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Traject laden...
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-xl bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {isEditing ? "Bewerk traject" : "Nieuw traject"}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                {isEditing ? form.name || selectedTraject?.name || "Naamloos traject" : "Maak een nieuw traject"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {isEditing && selectedTraject && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <CircleCheck className="h-3.5 w-3.5" />
                  Gekoppeld: {selectedTraject.competencyCount || 0} competenties
                </span>
              )}
              <button
                type="button"
                onClick={resetToNewForm}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Nieuw traject
              </button>
            </div>
          </div>

          {detailError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {detailError}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="traject-name" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Trajectnaam
            </label>
            <input
              id="traject-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              disabled={formDisabled}
              placeholder="Bijvoorbeeld: Sociaal Werk Niveau 5"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
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
              disabled={formDisabled}
              rows={3}
              placeholder="Optioneel. Geef een korte toelichting voor begeleiders."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Competentie-structuur</h2>
                <p className="text-xs text-slate-500">
                  Groepeer competenties per betekenisvolle cluster, zoals <strong>B1-K1</strong> met meerdere werkprocessen.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddGroup}
                disabled={formDisabled}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus className="h-4 w-4" />
                Nieuw cluster
              </button>
            </div>

            {form.competencyGroups.map((group, groupIndex) => (
              <div key={group.id} className="space-y-4 rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Cluster {groupIndex + 1}</p>
                    <h3 className="text-lg font-semibold text-slate-900">Competentiegebied</h3>
                    <p className="text-sm text-slate-500">Bijvoorbeeld B1-K1 met een herkenbare titel.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveGroup(group.id)}
                    disabled={formDisabled}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    Verwijder cluster
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cluster code</label>
                    <input
                      value={group.code}
                      onChange={(event) => handleGroupChange(group.id, "code", event.target.value)}
                      disabled={formDisabled}
                      placeholder="Bijv. B1-K1"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cluster naam</label>
                    <input
                      value={group.title}
                      onChange={(event) => handleGroupChange(group.id, "title", event.target.value)}
                      disabled={formDisabled}
                      placeholder="Bijv. Analyseren van ondersteuningsvragen"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {group.competencies.map((competency, competencyIndex) => (
                    <div key={competency.id} className="space-y-4 rounded-xl border border-slate-200 p-4 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Competentie {competencyIndex + 1}</p>
                          <p className="text-sm text-slate-500">Vul de werkprocescode en aanvullende velden in.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCompetency(group.id, competency.id)}
                          disabled={formDisabled}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                        >
                          <Trash2 className="h-4 w-4" />
                          Verwijder competentie
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Code</label>
                          <input
                            value={competency.code}
                            onChange={(event) => handleCompetencyChange(group.id, competency.id, "code", event.target.value)}
                            disabled={formDisabled}
                            placeholder="Bijv. B1-K1-W1"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Titel</label>
                          <input
                            value={competency.title}
                            onChange={(event) => handleCompetencyChange(group.id, competency.id, "title", event.target.value)}
                            disabled={formDisabled}
                            placeholder="Bijv. Ondersteuningsvragen analyseren"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Omschrijving</label>
                          <textarea
                            value={competency.description}
                            onChange={(event) => handleCompetencyChange(group.id, competency.id, "description", event.target.value)}
                            disabled={formDisabled}
                            rows={2}
                            placeholder="Optioneel. Beschrijf het werkproces kort."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gewenst resultaat</label>
                          <textarea
                            value={competency.desiredOutcome}
                            onChange={(event) => handleCompetencyChange(group.id, competency.id, "desiredOutcome", event.target.value)}
                            disabled={formDisabled}
                            rows={2}
                            placeholder="Wat moet er bereikt worden?"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vakkennis</label>
                          <textarea
                            value={competency.subjectKnowledge}
                            onChange={(event) => handleCompetencyChange(group.id, competency.id, "subjectKnowledge", event.target.value)}
                            disabled={formDisabled}
                            rows={2}
                            placeholder="Welke kennis is nodig?"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gedragscomponenten</label>
                          <textarea
                            value={competency.behavioralComponents}
                            onChange={(event) => handleCompetencyChange(group.id, competency.id, "behavioralComponents", event.target.value)}
                            disabled={formDisabled}
                            rows={2}
                            placeholder="Welke houding wordt verwacht?"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => handleAddCompetency(group.id)}
                    disabled={formDisabled}
                    className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-600 transition hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:border-brand-100 disabled:text-brand-200"
                  >
                    <Plus className="h-4 w-4" />
                    Voeg competentie toe
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm">
              {saveSuccess && <p className="text-sm font-medium text-emerald-600">{saveSuccess}</p>}
              {saveError && <p className="text-sm font-medium text-red-600">{saveError}</p>}
              {!saveSuccess && !saveError && (
                <p className="text-xs text-slate-500">
                  Je traject bevat {totalCompetencyCount} competenties verdeeld over {groupsWithCompetencies.length} clusters.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
              {isEditing ? "Wijzigingen opslaan" : "Traject opslaan"}
            </button>
          </div>
        </form>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Trajecten</h2>
            <button
              type="button"
              onClick={loadTrajects}
              disabled={loadingTrajects}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <RefreshCcw className={loadingTrajects ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Vernieuwen
            </button>
          </div>

          {loadingTrajects ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Trajecten laden...
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : trajects.length === 0 ? (
            <p className="text-sm text-slate-500">Er zijn nog geen trajecten aangemaakt.</p>
          ) : (
            <ul className="space-y-3">
              {trajects.map((traject) => {
                const isActive = traject.id === selectedTrajectId;
                return (
                  <li key={traject.id}>
                    <button
                      type="button"
                      onClick={() => loadTrajectDetail(traject.id)}
                      className={`w-full text-left transition focus:outline-none focus:ring-2 focus:ring-brand-200 ${
                        isActive
                          ? "rounded-xl border border-brand-300 bg-brand-50 p-4 shadow-sm"
                          : "rounded-xl border border-slate-200 p-4 shadow-sm hover:border-brand-200 hover:bg-brand-50/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{traject.name}</h3>
                          <p className="text-xs text-slate-500">
                            {traject.competencyGroups?.length || 0} clusters · {traject.competencyCount || 0} competenties
                          </p>
                        </div>
                        {isActive && <CircleCheck className="h-4 w-4 text-brand-600" />}
                      </div>
                      <p className="mt-2 text-xs text-slate-400">Laatst bijgewerkt: {formatDate(traject.updatedAt)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
};

export default AdminTrajects;
