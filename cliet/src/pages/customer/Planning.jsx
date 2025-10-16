import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, ChevronDown, MessageCircle, Paperclip, Trash2 } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import { get } from "../../lib/api";
import {
  fetchTraject,
  deleteCustomerEvidence,
  resolveUploadDownloadUrl,
  subscribeCustomerUploads,
  subscribeTrajectCompetencies,
  uploadCustomerEvidence,
} from "../../lib/firestoreCustomer";

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
  const [customerUploads, setCustomerUploads] = useState([]);
  const [uploadsError, setUploadsError] = useState(null);
  const [downloadInProgress, setDownloadInProgress] = useState(null);
  const [deletingUploadId, setDeletingUploadId] = useState(null);
  const [uploadNames, setUploadNames] = useState({});
  const [uploadNameErrors, setUploadNameErrors] = useState({});
  const [showInstructions, setShowInstructions] = useState(false);
  const fileInputsRef = useRef({});
  const [storedUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (_err) {
      return null;
    }
  });
  const customerId = customer?.id || null;
  const participantName = customer?.name || "deelnemer";

  const loadPlanning = useCallback(async () => {
    setLoadingApi(true);
    setError(null);
    try {
      const data = await get("/customer/planning");
      if (data?.traject) {
        setTraject(data.traject);
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

  const uploadsByCompetency = useMemo(() => {
    const grouped = {};
    customerUploads.forEach((upload) => {
      if (!upload) return;
      const key = upload.competencyId || "__unassigned__";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(upload);
    });
    return grouped;
  }, [customerUploads]);

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

  useEffect(() => {
    if (!customerId) {
      setCustomerUploads([]);
      setUploadsError(null);
      return undefined;
    }

    const unsubscribe = subscribeCustomerUploads(customerId, ({ uploads, error: subscriptionError }) => {
      if (subscriptionError) {
        setUploadsError(subscriptionError);
        return;
      }
      setUploadsError(null);
      setCustomerUploads(Array.isArray(uploads) ? uploads : []);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [customerId]);

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

    if (!customerId) {
      setError("Kon je accountgegevens niet vinden. Probeer opnieuw in te loggen.");
      return;
    }

    const desiredName = (uploadNames[competencyId] || "").trim();
    if (!desiredName) {
      setUploadNameErrors((previous) => ({ ...previous, [competencyId]: "Geef een naam op voor je upload." }));
      return;
    }

    setUploading(competencyId);
    setError(null);
    try {
      await uploadCustomerEvidence({
        userId: customerId,
        competencyId,
        file,
        displayName: desiredName,
        trajectId,
      });
      setUploadNames((previous) => ({ ...previous, [competencyId]: "" }));
      setUploadNameErrors((previous) => {
        if (!previous[competencyId]) return previous;
        const next = { ...previous };
        delete next[competencyId];
        return next;
      });
    } catch (err) {
      setError(err?.message || "Uploaden mislukt");
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

  const toggleInstructions = () => {
    setShowInstructions((previous) => !previous);
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

  const getUploadsFor = (competency, fallbackKey) => {
    if (!competency) return [];
    const candidates = [competency.id, competency.code, fallbackKey].filter(Boolean);
    for (const candidate of candidates) {
      if (uploadsByCompetency[candidate]) {
        return uploadsByCompetency[candidate];
      }
    }
    return [];
  };

  const handleDownload = async (upload) => {
    if (!upload) return;
    const canDownload = Boolean(upload.downloadURL || upload.storagePath);
    if (!canDownload) {
      setError("Downloadlink is niet beschikbaar voor dit bestand.");
      return;
    }

    const downloadKey = upload.id || upload.storagePath || upload.fileName || upload.name || null;
    if (downloadKey) {
      setDownloadInProgress(downloadKey);
    }

    setError(null);

    try {
      const url = await resolveUploadDownloadUrl(upload);
      if (!url) {
        throw new Error("Downloadlink is niet beschikbaar.");
      }
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err?.message || "Download mislukt");
    } finally {
      setDownloadInProgress(null);
    }
  };

  const handleDeleteUpload = async (upload) => {
    if (!upload || !upload.id) return;
    if (!customerId) {
      setError("Kon je accountgegevens niet vinden. Probeer opnieuw in te loggen.");
      return;
    }

    setDeletingUploadId(upload.id);
    try {
      await deleteCustomerEvidence({
        userId: customerId,
        uploadId: upload.id,
        storagePath: upload.storagePath || null,
      });
    } catch (err) {
      setError(err?.message || "Verwijderen mislukt");
    } finally {
      setDeletingUploadId(null);
    }
  };

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Mijn portfolio</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Jouw verzameling aan bewijsstukken</h1>
        <div className="mt-3 max-w-3xl space-y-4 text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Portfolio {participantName}</p>
          <p>Beste deelnemer,</p>
          <p>
            Bij de EVC-procedure beoordelen we hoe goed jouw vaardigheden en kennis overeenkomen met wat er van je verwacht wordt in je beroep,
            door te kijken naar hoe je je werk uitvoert. Dit houdt in dat je moet laten zien dat je de juiste kennis, vaardigheden en professionele
            houding hebt door middel van voorbeelden uit de praktijk. Dit doe je door in je portfolio te beschrijven wat je hebt gedaan, hoe je het
            hebt gedaan en waarom, ondersteund met bewijs uit je werkervaring. Vergeet niet je werkervaring en CV toe te voegen aan je portfolio.
          </p>
          <p>
            We begrijpen dat dit een uitgebreide taak kan zijn, maar we staan klaar om je te helpen! Om je te ondersteunen, bieden we formulieren,
            instructievideo&apos;s en documenten aan die je kunnen helpen je ervaringen correct te documenteren. Je EVC-begeleider staat ook altijd klaar
            om je hulp of feedback te geven.
          </p>
          <p>
            Wat betreft privacy, volgens de privacywet (AVG), mag je geen persoonlijke gegevens in je portfolio opnemen zonder toestemming. Je mag wel
            geanonimiseerde gegevens gebruiken, waarbij de persoon niet herkenbaar is, ook niet zonder naamvermelding.
          </p>
        </div>
        {traject ? (
          <p className="mt-4 inline-flex items-center rounded-full bg-evc-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-evc-blue-700">
            Traject: {traject.name}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={toggleInstructions}
            className="inline-flex items-center justify-between rounded-2xl bg-evc-blue-600 px-5 py-3 text-left text-sm font-semibold text-white shadow-lg transition hover:bg-evc-blue-500 sm:text-base"
          >
            <span>Klik hier voor de instructies</span>
            <ChevronDown
              className={`h-5 w-5 transition-transform ${showInstructions ? "rotate-180" : ""}`}
            />
          </button>
          {showInstructions ? (
            <div className="rounded-2xl border border-evc-blue-200 bg-evc-blue-50 p-5 text-sm text-evc-blue-900">
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-evc-blue-800">Bekijk het volgende document: instructieformulier</h3>
                <p>
                  Voor uitgebreide instructies en tips over het samenstellen van je portfolio, klik je op de knop hieronder! Het is belangrijk om deze
                  instructie en de instructievideo&apos;s op het dashboard te bekijken voordat je begint met je portfolio.
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-evc-blue-700">
                  Belangrijk: klik hieronder voor uitgebreide instructies!
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {isLoading ? <LoadingSpinner label="Portfolio laden" /> : null}
      {error && !isLoading ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {firestoreError && !isLoading ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Kon competenties niet laden: {firestoreError.message || "Onbekende fout"}
        </div>
      ) : null}
      {uploadsError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Kon uploads niet laden: {uploadsError.message || "Onbekende fout"}
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

      <section className="space-y-6">
        <header className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Trajectportfolio</h2>
          <p className="max-w-2xl text-sm text-slate-500">
            Orden je opleiding, werkervaring en documenten per competentie. Voeg nieuwe bewijsstukken toe en houd overzicht in je voortgang.
            {coach ? ` Je coach ${coach.name} kijkt mee en geeft feedback.` : ""}
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          {competencies.map((item, index) => {
            const key = item.id || item.code || String(index);
            const isExpanded = expandedIds.includes(key);
            const uploads = getUploadsFor(item, key);
            const detailId = `competency-${key}`;

            return (
              <article
                key={key}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => toggleCompetency(key)}
                  className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isExpanded}
                  aria-controls={detailId}
                >
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-evc-blue-600">
                      {item.code || `Competentie ${index + 1}`}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {item.name || item.title || "Onbenoemde competentie"}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {item.description || item.summary || "Bekijk de details van deze competentie."}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <div
                  id={detailId}
                  className={`grid gap-6 overflow-hidden border-t border-slate-100 px-6 transition-[max-height] duration-500 ${
                    isExpanded ? "max-h-[999px] py-6" : "max-h-0"
                  }`}
                >
                  {isExpanded ? (
                    <>
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                          Wat wordt er van je verwacht?
                        </h4>
                        {renderBulletList(item.expectations, "Nog geen verwachtingen vastgelegd.")}
                        <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                          <p className="font-semibold text-slate-700">Gewenst resultaat</p>
                          <p className="mt-2 leading-relaxed">
                            {item.desiredOutcome || "Nog niet vastgelegd."}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Bewijsstukken</h4>
                        <div className="space-y-3">
                          {uploads.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                              Nog geen bestanden. Klik op "Voeg upload toe" om te starten.
                            </p>
                          ) : (
                            <ul className="space-y-2 text-sm text-slate-600">
                              {uploads.map((upload) => {
                                const canDownload = Boolean(upload.downloadURL || upload.storagePath);
                                const downloadKey = upload.id || upload.storagePath || upload.fileName || upload.name;
                                return (
                                  <li
                                    key={downloadKey}
                                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm"
                                  >
                                    <Paperclip className="h-4 w-4 text-slate-400" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-slate-700">
                                        {upload.displayName || upload.name || upload.fileName}
                                      </p>
                                      {upload.uploadedAt ? (
                                        <p className="mt-0.5 text-xs text-slate-400">
                                          Geüpload op {upload.uploadedAt.toLocaleString()}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="ml-auto flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="whitespace-nowrap rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                                        onClick={() => handleDownload(upload)}
                                        disabled={downloadInProgress === downloadKey || !canDownload}
                                      >
                                        {downloadInProgress === downloadKey
                                          ? "Bezig..."
                                          : canDownload
                                          ? "Download"
                                          : "Niet beschikbaar"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteUpload(upload)}
                                        disabled={deletingUploadId === upload.id}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-500 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                                        aria-label="Verwijder upload"
                                      >
                                        {deletingUploadId === upload.id ? (
                                          <span className="text-[10px] font-semibold uppercase tracking-wide">Wacht</span>
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
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

                        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                          <MessageCircle className="h-4 w-4 text-brand-500" />
                          <span className="leading-relaxed">
                            Heb je vragen? Laat een bericht achter bij je coach in het berichtenoverzicht.
                          </span>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default CustomerPlanning;
