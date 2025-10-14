import React, { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, ChevronDown, MessageCircle, Paperclip } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import { get, postForm } from "../../lib/api";
import { fetchTraject, subscribeTrajectCompetencies } from "../../lib/firestoreCustomer";

const CustomerPlanning = () => {
  const { customer, coach } = useOutletContext();
  const [traject, setTraject] = useState(null);
  const [competencies, setCompetencies] = useState([]);
  const [expandedIds, setExpandedIds] = useState([]);
  const [loadingApi, setLoadingApi] = useState(true);
  const [loadingFirestore, setLoadingFirestore] = useState(true);
  const [error, setError] = useState(null);
  const [firestoreError, setFirestoreError] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [uploadsByCompetency, setUploadsByCompetency] = useState({});
  const [uploadNames, setUploadNames] = useState({});
  const [uploadNameErrors, setUploadNameErrors] = useState({});
  const fileInputsRef = useRef({});
  const [storedUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (_err) {
      return null;
    }
  });

  const loadPlanning = useCallback(async () => {
    setLoadingApi(true);
    setError(null);
    try {
      const data = await get("/customer/planning");
      if (data?.traject) {
        setTraject(data.traject);
      }
      if (Array.isArray(data?.competencies)) {
        const uploadsMap = {};
        data.competencies.forEach((item) => {
          const key = item.id || item.code;
          if (!key) return;
          uploadsMap[key] = Array.isArray(item.uploads) ? item.uploads : [];
        });
        setUploadsByCompetency(uploadsMap);
      } else {
        setUploadsByCompetency({});
      }
    } catch (err) {
      setError(err?.data?.error || err?.message || "Kon planning niet laden");
    } finally {
      setLoadingApi(false);
    }
  }, []);

  useEffect(() => {
    loadPlanning();
  }, [loadPlanning]);

  const derivedTrajectId = traject?.id || storedUser?.trajectId || customer?.trajectId || null;

  useEffect(() => {
    if (!derivedTrajectId) {
      setCompetencies([]);
      setFirestoreError(null);
      setLoadingFirestore(false);
      return;
    }

    setLoadingFirestore(true);
    const unsubscribe = subscribeTrajectCompetencies(derivedTrajectId, ({ data, error: subscriptionError }) => {
      if (subscriptionError) {
        setFirestoreError(subscriptionError);
        setLoadingFirestore(false);
        return;
      }
      setFirestoreError(null);
      setCompetencies(Array.isArray(data) ? data : []);
      setLoadingFirestore(false);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [derivedTrajectId]);

  useEffect(() => {
    if (traject || !derivedTrajectId) return undefined;
    let cancelled = false;
    fetchTraject(derivedTrajectId)
      .then((doc) => {
        if (!cancelled && doc) {
          setTraject((previous) => previous || doc);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [traject, derivedTrajectId]);

  const isLoading = loadingApi || loadingFirestore;

  const handleTriggerUpload = (key) => {
    const desiredName = (uploadNames[key] || "").trim();
    if (!desiredName) {
      setUploadNameErrors((previous) => ({ ...previous, [key]: "Geef een naam op voor je upload." }));
      return;
    }

    setUploadNameErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });

    const input = fileInputsRef.current[key];
    if (input) {
      input.click();
    }
  };

  const handleUpload = async (competencyId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    const trajectId = derivedTrajectId;
    if (!trajectId) {
      setError("Er is geen traject gekoppeld aan dit account.");
      return;
    }

    const desiredName = (uploadNames[competencyId] || "").trim();
    if (!desiredName) {
      setUploadNameErrors((previous) => ({ ...previous, [competencyId]: "Geef een naam op voor je upload." }));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", desiredName);
    formData.append("trajectId", trajectId);
    formData.append("competencyId", competencyId);

    setUploading(competencyId);
    setError(null);
    try {
      await postForm("/evidence/upload", formData);
      await loadPlanning();
      setUploadNames((previous) => ({ ...previous, [competencyId]: "" }));
      setUploadNameErrors((previous) => {
        if (!previous[competencyId]) return previous;
        const next = { ...previous };
        delete next[competencyId];
        return next;
      });
    } catch (err) {
      setError(err?.data?.error || err?.message || "Uploaden mislukt");
    } finally {
      setUploading(null);
    }
  };

  const toggleCompetency = (id) => {
    setExpandedIds((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]
    );
  };

  const handleUploadNameChange = (key, value) => {
    setUploadNames((previous) => ({ ...previous, [key]: value }));
    setUploadNameErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    setExpandedIds((previous) => {
      const validKeys = new Set(
        competencies.map((item, index) => item.id || item.code || String(index))
      );
      const next = previous.filter((id) => validKeys.has(id));
      return next.length === previous.length ? previous : next;
    });
  }, [competencies]);

  useEffect(() => {
    const validKeys = new Set(
      competencies.map((item, index) => item.id || item.code || String(index))
    );

    setUploadNames((previous) => {
      const next = {};
      validKeys.forEach((key) => {
        if (previous[key] !== undefined) {
          next[key] = previous[key];
        }
      });
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });

    setUploadNameErrors((previous) => {
      const next = {};
      validKeys.forEach((key) => {
        if (previous[key]) {
          next[key] = previous[key];
        }
      });
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });
  }, [competencies]);

  const renderBulletList = (items, emptyMessage) => {
    if (!items || items.length === 0) {
      return <p className="mt-2 text-sm text-slate-400">{emptyMessage}</p>;
    }

    return (
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {items.map((value, index) => (
          <li
            key={`${value}-${index}`}
            className="flex items-start gap-3 rounded-xl bg-white/70 px-3 py-2 shadow-sm"
          >
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
            <span className="leading-relaxed">{String(value)}</span>
          </li>
        ))}
      </ul>
    );
  };

  const getUploadsFor = (competency) => {
    if (!competency) return [];
    return (
      uploadsByCompetency[competency.id] ||
      uploadsByCompetency[competency.code] ||
      []
    );
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Planning</p>
        <h1 className="text-3xl font-semibold text-slate-900">Jouw competenties en bewijsstukken</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Bekijk welke competenties onderdeel zijn van je traject en voeg eenvoudig nieuwe bewijsstukken toe.
          {coach ? ` Je coach ${coach.name} kijkt mee en geeft feedback.` : ""}
        </p>
        {traject ? (
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Traject: {traject.name}
          </p>
        ) : null}
      </header>

      {isLoading ? <LoadingSpinner label="Planning laden" /> : null}
      {error && !isLoading ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {firestoreError && !isLoading ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Kon competenties niet laden: {firestoreError.message || "Onbekende fout"}
        </div>
      ) : null}

      {!isLoading && !derivedTrajectId ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-400">
          Er is nog geen traject aan jouw account gekoppeld.
        </div>
      ) : null}

      {!isLoading && derivedTrajectId && competencies.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-400">
          Er zijn nog geen competenties gekoppeld aan jouw traject.
        </div>
      ) : null}

      <section className="space-y-4">
        {competencies.map((item, index) => {
          const key = item.id || item.code || String(index);
          const isExpanded = expandedIds.includes(key);
          const uploads = getUploadsFor(item);
          const detailId = `competency-${key}`;

          return (
            <article
              key={key}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => toggleCompetency(key)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                aria-expanded={isExpanded}
                aria-controls={detailId}
              >
                <div className="flex flex-col gap-2">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {item.code || "Code ontbreekt"}
                  </span>
                  <h2 className="text-lg font-semibold text-slate-900">{item.title || "Competentie zonder titel"}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-600 sm:inline-flex">
                    <CheckCircle2 className="h-4 w-4" /> Actief
                  </span>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-all duration-300 ${
                      isExpanded ? "rotate-180 border-brand-200 bg-brand-50 text-brand-600 shadow-inner" : ""
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </button>

              <div
                id={detailId}
                className={`px-6 ${isExpanded ? "pb-6" : "hidden"}`}
                hidden={!isExpanded}
              >
                <div className="space-y-6 rounded-2xl border border-slate-100 bg-slate-50/80 px-5 py-5 text-slate-600">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Omschrijving</p>
                    <p className="mt-2 text-base leading-relaxed text-slate-600">
                      {item.description || "Geen omschrijving beschikbaar."}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white px-4 py-4 shadow-inner">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Gewenst resultaat</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {item.desiredOutcome || "Nog niet vastgelegd."}
                    </p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vakkennis &amp; vaardigheden</p>
                      {renderBulletList(item.subjectKnowledge, "Nog geen vakkennis vastgelegd.")}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Gedragscomponenten</p>
                        {renderBulletList(item.behavioralComponents, "Nog geen gedragscomponenten vastgelegd.")}
                      </div>

                      <div className="space-y-3 rounded-2xl bg-white px-4 py-4 shadow-inner">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Uploads ({uploads.length})
                        </p>
                        {uploads.length === 0 ? (
                          <p className="text-sm text-slate-400">
                            Nog geen bestanden. Klik op "Voeg upload toe" om te starten.
                          </p>
                        ) : (
                          <ul className="space-y-2 text-sm text-slate-600">
                            {uploads.map((upload) => (
                              <li
                                key={upload.id || upload.name}
                                className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm"
                              >
                                <Paperclip className="h-4 w-4 text-slate-400" />
                                <span className="truncate text-sm leading-snug">{upload.name}</span>
                                <button
                                  type="button"
                                  className="ml-auto text-xs font-semibold text-brand-600 transition hover:text-brand-500"
                                  onClick={() => (upload.filePath ? window.open(upload.filePath, "_blank") : null)}
                                >
                                  {upload.filePath ? "Download" : "Bekijk"}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Naam van je upload
                            </label>
                            <input
                              type="text"
                              value={uploadNames[key] || ""}
                              onChange={(event) => handleUploadNameChange(key, event.target.value)}
                              placeholder="Bijvoorbeeld: Reflectieverslag week 3"
                              className={`mt-2 w-full rounded-full border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                                uploadNameErrors[key]
                                  ? "border-red-300 focus:ring-red-300"
                                  : "border-slate-200 focus:border-brand-400"
                              }`}
                            />
                            {uploadNameErrors[key] ? (
                              <p className="mt-1 text-xs text-red-500">{uploadNameErrors[key]}</p>
                            ) : null}
                          </div>
                          <input
                            ref={(node) => {
                              if (node) {
                                fileInputsRef.current[key] = node;
                              } else {
                                delete fileInputsRef.current[key];
                              }
                            }}
                            type="file"
                            className="hidden"
                            onChange={(event) => handleUpload(item.id || item.code || key, event)}
                          />
                          <button
                            type="button"
                            onClick={() => handleTriggerUpload(key)}
                            disabled={uploading === (item.id || item.code || key)}
                            className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-300 px-3 py-2 text-xs font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                          >
                            <Paperclip className="h-4 w-4" />
                            {uploading === (item.id || item.code || key) ? "Bezig..." : "Voeg upload toe"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-inner">
                    <MessageCircle className="h-4 w-4 text-brand-500" />
                    <span className="leading-relaxed">
                      Heb je vragen? Laat een bericht achter bij je coach in het berichtenoverzicht.
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
};

export default CustomerPlanning;
