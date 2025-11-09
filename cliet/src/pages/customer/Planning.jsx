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
  subscribeCustomerResume,
  linkProfileItemToCompetency,
  unlinkProfileItemFromCompetency,
  uploadCustomerEvidence,
  unlinkUploadFromCompetency,
} from "../../lib/firestoreCustomer";
import { migrateLegacyEducationProfile } from "../../lib/firestoreCustomer";
import { storage } from "../../firebase";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { isCollectingStatus } from "../../lib/trajectStatus";

const CustomerPlanning = () => {
  const { customer, coach, assignment } = useOutletContext();
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
  const [unlinkingUploadId, setUnlinkingUploadId] = useState(null);
  const [deletingUploadId, setDeletingUploadId] = useState(null);
  const [uploadNames, setUploadNames] = useState({});
  const [uploadNameErrors, setUploadNameErrors] = useState({});
  const [resume, setResume] = useState({ educationItems: [], educations: [], certificates: [], workExperience: [], overigeDocumenten: [] });
  const [resumeError, setResumeError] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [materials, setMaterials] = useState({ starr: null, vraak: null, auth: null });
  const fileInputsRef = useRef({});
  const [storedUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (_err) {
      return null;
    }
  });
  const customerId = customer?.id || null;
  const participantName = customer?.name || "kandidaat";
  const isEditable = isCollectingStatus(assignment?.status);

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
  setResume({ educationItems: [], educations: [], certificates: [], workExperience: [], overigeDocumenten: [] });
      setResumeError(null);
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

    // Ensure unified education data is available
    migrateLegacyEducationProfile(customerId).catch(() => {});
    const unsubscribeResume = subscribeCustomerResume(customerId, ({ data, error }) => {
      if (error) {
        setResumeError(error);
        return;
      }
      setResumeError(null);
      const safe = data || {};
      setResume({
        educationItems: Array.isArray(safe.educationItems) ? safe.educationItems : [],
        educations: Array.isArray(safe.educations) ? safe.educations : [],
        certificates: Array.isArray(safe.certificates) ? safe.certificates : [],
        workExperience: Array.isArray(safe.workExperience) ? safe.workExperience : [],
        overigeDocumenten: Array.isArray(safe.overigeDocumenten) ? safe.overigeDocumenten : [],
      });
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
      if (typeof unsubscribeResume === "function") {
        unsubscribeResume();
      }
    };
  }, [customerId]);

  const isLoading = loadingApi || loadingFirestore;

  const handleTriggerUpload = (key) => {
    if (!isEditable) {
      setError("Je traject bevindt zich in de beoordelingsfase. Aanpassingen zijn tijdelijk niet mogelijk.");
      return;
    }
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

    if (!isEditable) {
      setError("Je traject bevindt zich in de beoordelingsfase. Aanpassingen zijn tijdelijk niet mogelijk.");
      return;
    }

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

  // Resolve Firebase Storage download URLs for public materials
  useEffect(() => {
    let cancelled = false;
    const paths = {
      starr: ["public-docs/STARR-formulier.docx"],
      vraak: ["public-docs/VRAAK-criteria PBMZ.pdf"],
      auth: ["public-docs/Authenticiteit verklaring.pdf"],
    };

    const loadAll = async () => {
      const next = { starr: null, vraak: null, auth: null };
      for (const key of Object.keys(paths)) {
        const candidates = paths[key];
        for (let i = 0; i < candidates.length; i += 1) {
          try {
            const url = await getDownloadURL(storageRef(storage, candidates[i]));
            next[key] = url;
            break;
          } catch (_) {
            // try next candidate
          }
        }
      }
      if (!cancelled) setMaterials(next);
    };
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const renderBulletList = (items, emptyMessage, size = "sm") => {
  if (!items || items.length === 0) {
    return (
      <p
        className={`mt-2 ${
          size === "xs" ? "text-[15px]" : "text-[16px]"
        } text-slate-500 font-medium`}
      >
        {emptyMessage}
      </p>
    );
  }

  const listGap = size === "xs" ? "space-y-2" : "space-y-3";
  const textSize = size === "xs" ? "text-[15px]" : "text-[16px]";
  const badgeSize = size === "xs" ? "mt-1 h-1.5 w-1.5" : "mt-1.5 h-2 w-2";
  const padding = size === "xs" ? "px-3 py-1.5" : "px-3.5 py-2.5";

  return (
    <ul className={`mt-3 ${listGap} ${textSize} text-slate-800 font-medium`}>
      {items.map((value, index) => (
        <li
          key={`${value}-${index}`}
          className={`flex items-start gap-3 rounded-xl bg-white px-3 py-2 shadow-sm border border-slate-100`}
        >
          <span
            className={`${badgeSize} flex-shrink-0 rounded-full bg-evc-blue-600 mt-[6px]`}
          />
          <span className="leading-relaxed break-words whitespace-pre-line">
            {String(value)}
          </span>
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

  // Build a map of competencyId -> linked profile entries
  const linkedByCompetency = useMemo(() => {
    const map = {};
    const add = (section, items) => {
      (items || []).forEach((entry) => {
        const links = Array.isArray(entry.linkedCompetencies) ? entry.linkedCompetencies : [];
        links.forEach((compId) => {
          if (!map[compId]) map[compId] = [];
          map[compId].push({ ...entry, __section: section });
        });
      });
    };
    add("educationItems", resume.educationItems);
    add("education", resume.educations);
    add("certificate", resume.certificates);
    add("work", resume.workExperience);
    return map;
  }, [resume.educationItems, resume.educations, resume.certificates, resume.workExperience]);

  const [linkSelections, setLinkSelections] = useState({});
  const handleLinkSelect = async (competencyKey, value) => {
    // value format: section|itemId
    if (!value) return;
    if (!isEditable) {
      setError("Je traject bevindt zich in de beoordelingsfase. Aanpassingen zijn tijdelijk niet mogelijk.");
      return;
    }
    const [section, itemId] = value.split("|");
    const sectionKey = section === "education"
      ? "educations"
      : section === "certificate"
      ? "certificates"
      : section === "educationItems"
      ? "educationItems"
      : "workExperience";
    try {
      setLinkSelections((prev) => ({ ...prev, [competencyKey]: "linking" }));
      await linkProfileItemToCompetency({
        userId: customerId,
        sectionKey,
        itemId,
        competencyId: competencyKey,
      });
      setLinkSelections((prev) => ({ ...prev, [competencyKey]: "" }));
    } catch (err) {
      setLinkSelections((prev) => ({ ...prev, [competencyKey]: "" }));
      setError(err?.message || "Koppelen mislukt");
    }
  };

  const handleUnlink = async (competencyKey, entry) => {
    if (!isEditable) {
      setError("Je traject bevindt zich in de beoordelingsfase. Aanpassingen zijn tijdelijk niet mogelijk.");
      return;
    }
    // Map the entry source section to the correct profiles/{uid} array key
    const sectionKey =
      entry.__section === "education"
        ? "educations"
        : entry.__section === "certificate"
        ? "certificates"
        : entry.__section === "educationItems"
        ? "educationItems"
        : "workExperience";
    try {
      await unlinkProfileItemFromCompetency({
        userId: customerId,
        sectionKey,
        itemId: entry.id,
        competencyId: competencyKey,
      });
    } catch (err) {
      console.error("Unlink profile item failed", err);
      setError(err?.message || "Ontkoppelen mislukt");
    }
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
    if (!isEditable) {
      setError("Je traject bevindt zich in de beoordelingsfase. Aanpassingen zijn tijdelijk niet mogelijk.");
      return;
    }
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

  const handleUnlinkUpload = async (upload) => {
    if (!upload || !upload.id) return;
    if (!isEditable) {
      setError("Je traject bevindt zich in de beoordelingsfase. Aanpassingen zijn tijdelijk niet mogelijk.");
      return;
    }
    if (!customerId) {
      setError("Kon je accountgegevens niet vinden. Probeer opnieuw in te loggen.");
      return;
    }

    setUnlinkingUploadId(upload.id);
    try {
      await unlinkUploadFromCompetency({ userId: customerId, uploadId: upload.id });
      // Firestore onSnapshot will update UI; no manual state change needed
    } catch (err) {
      console.error("Unlink upload failed", err);
      setError(err?.message || "Ontkoppelen mislukt");
    } finally {
      setUnlinkingUploadId(null);
    }
  };

  return (
    <div className="planning-page space-y-10">
      {!isEditable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          🔒 Je traject bevindt zich in de beoordelingsfase. Aanpassingen aan bewijsstukken zijn tijdelijk niet mogelijk.
        </div>
      ) : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Portfolio {participantName}</h1>
        <div className="mt-3 max-w-3xl space-y-4 text-sm text-slate-500">
          
          <p>Beste kandidaat,</p>
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

      {/* Section 1: Opleidingen, diploma's en certificaten */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-2">
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Opleidingen, diploma's en certificaten</h2>
          <p className="text-sm text-slate-500">Overzicht van je opleidingen en officiële documenten.</p>
        </header>
        {resumeError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Kon profiel niet laden: {resumeError.message}</div>
        ) : (
          <div>
            {(resume.educationItems || []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Nog geen opleiding of cursus geregistreerd.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {resume.educationItems.map((it) => (
                  <li key={it.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{it.title}</p>
                        <p className="text-xs text-slate-500">{it.year ? `Afgesloten in ${it.year}` : "Jaar onbekend"} • {it.diplomaObtained ? "Diploma/certificaat behaald" : "Geen diploma/certificaat"} • {it.type || "Anders"}</p>
                      </div>
                    </div>
                    {it.note ? <p className="mt-2 text-sm text-slate-600">{it.note}</p> : null}
                    {Array.isArray(it.attachments) && it.attachments.length > 0 ? (
                      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {it.attachments.map((att) => (
                          <li key={att.id || att.storagePath}>
                            <a href={att.downloadURL} target="_blank" rel="noreferrer" className="inline-flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 shadow-sm hover:text-brand-600">
                              <span aria-hidden>📎</span>
                              <span className="truncate">{att.name || "bijlage"}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Relevante werkervaring */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-2">
          <h2 className="text-xl font-semibold text-slate-900">Relevante werkervaring</h2>
          <p className="text-sm text-slate-500">Belangrijke werkervaringen met toelichting.</p>
        </header>
        {(resume.workExperience || []).length === 0 ? (
          <p className="text-sm text-slate-400">Nog geen werkervaring toegevoegd.</p>
        ) : (
          <ul className="space-y-2">
            {resume.workExperience.map((we) => (
              <li key={we.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{we.role || "Functie onbekend"}</p>
                <p className="text-xs uppercase tracking-wide text-slate-400">{we.organisation || ""}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                  {we.startDate ? <span>Start: {we.startDate}</span> : null}
                  {we.endDate ? <span>Einde: {we.endDate}</span> : null}
                </div>
                {we.note ? <p className="mt-2 text-sm text-slate-600">{we.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      

      {/* Section 4: Overige informatie en documenten (profiel) */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-2">
          <h2 className="text-xl font-semibold text-slate-900">Overige informatie en documenten</h2>
          <p className="text-sm text-slate-500">Overige bewijsstukken uit je profiel.</p>
        </header>
        {(resume.overigeDocumenten || []).length === 0 ? (
          <p className="text-sm text-slate-400">Nog geen overige informatie toegevoegd.</p>
        ) : (
          <ul className="space-y-2">
            {resume.overigeDocumenten.map((doc) => {
              const createdAt = (() => {
                const raw = doc.createdAt;
                try {
                  if (!raw) return null;
                  if (typeof raw.toDate === "function") return raw.toDate();
                  const d = new Date(raw);
                  return Number.isNaN(d.getTime()) ? null : d;
                } catch (_) { return null; }
              })();
              return (
                <li key={doc.id || doc.fileUrl} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{doc.omschrijving}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                        {doc.datum ? <span>Datum bewijsstuk: {doc.datum}</span> : null}
                        {createdAt ? <span>Toegevoegd: {createdAt.toLocaleDateString()}</span> : null}
                      </div>
                    </div>
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-600 hover:text-brand-500">Bekijk</a>
                    ) : null}
                  </div>
                  {doc.toelichting ? <p className="mt-2 text-sm text-slate-600">{doc.toelichting}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-3xl font-extrabold uppercase text-black-600 mb-2">
  Belangrijk! Klik hieronder en lees verder
</h2>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={toggleInstructions}
            className="inline-flex items-center justify-between rounded-2xl bg-evc-blue-600 px-5 py-3 text-left text-sm font-semibold text-white shadow-lg transition hover:bg-evc-blue-500 sm:text-base">
            <span>Klik hier voor de instructies</span>
            <ChevronDown
              className={`h-5 w-5 transition-transform ${showInstructions ? "rotate-180" : ""}`}
            />
          </button>
          {showInstructions ? (
            <div className="rounded-2xl border border-evc-blue-200 bg-evc-blue-50 p-6 text-[17px] leading-relaxed text-black">
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-evc-blue-800 font-[Poppins]">
                Instructies voor Mijn portfolio
              </h3>

              <div className="space-y-3">
                <p>
                  Hieronder staat per onderdeel uitgelegd hoe je jouw portfolio aanlevert. Volg de stappen zorgvuldig. 
                  Heb je vragen? Neem contact op met je begeleider via de pagina <strong>Berichten (Contact)</strong>.
                </p>
              </div>

              {/* Mijn profiel */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Mijn profiel</p>
                <ul className="list-disc space-y-1 pl-5 text-black marker:text-evc-blue-700">
                  <li>Voeg een duidelijke profielfoto van jezelf toe (zichtbaar voor de assessor).</li>
                  <li>Vink aan: ‘Ik neem vrijwillig deel aan dit EVC-traject’.</li>
                </ul>
              </div>

              {/* Mijn loopbaandoel */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Mijn loopbaandoel</p>
                <p>Begin met het invullen van je loopbaandoel op de pagina ‘Mijn loopbaandoel’. Beschrijf minimaal:</p>
                <ul className="list-disc space-y-1 pl-5 text-black marker:text-evc-blue-700">
                  <li>
                    <strong>Ambitie:</strong> Wat je nog wilt bereiken en hoe je jouw loopbaan de komende jaren ziet.
                  </li>
                  <li>
                    <strong>Motivatie:</strong> Wat je van dit EVC-traject verwacht, waarom je meedoet en welke resultaten je hoopt te behalen.
                  </li>
                </ul>
                <p className="text-slate-700">Dit komt terug tijdens het assessmentgesprek en in je EVC-rapport.</p>
              </div>

              {/* Vragenlijst */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Vragenlijst (Loopbaan en Burgerschap)</p>
                <p>
                  Vul de vragenlijst voor Loopbaan en Burgerschap (L&amp;B) volledig en onderbouwd in. 
                  Dit is verplicht voor alle MBO-opleidingen. Denk aan ongeveer 2 à 3 alinea’s per onderdeel. 
                  Dit onderdeel wordt meegenomen door de examencommissie bij de verzilvering van het EVC-certificaat.
                </p>
              </div>

              {/* Zo werkt dit scherm */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Zo werkt dit scherm</p>
                <ul className="list-disc space-y-1 pl-5 text-black marker:text-evc-blue-700">
                  <li>Alle competenties staan onder elkaar. Klik op een competentie om de details te openen of te sluiten.</li>
                  <li>Je ziet per competentie: verwachtingen, vakkennis/vaardigheden, gedragscomponenten en het gewenste resultaat.</li>
                  <li>Voeg bewijsstukken toe per competentie. Geef eerst een <strong>verplichte titel</strong> in het veld ‘Naam van je upload’ en klik daarna op ‘Voeg upload toe’.</li>
                  <li>Je kunt meerdere bestanden per competentie plaatsen. Je begeleider kan ze bekijken, downloaden en feedback geven.</li>
                  <li>Gebruik de knoppen ‘Download’ en ‘Verwijder’ om je bestanden te beheren.</li>
                </ul>
              </div>

              {/* Mijn portfolio */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Mijn portfolio: wat lever je aan?</p>
                <p>
                  In je portfolio laat je zien wat je allemaal kunt en hebt gedaan. Voeg informatie toe over je werk, cursussen, diploma’s en certificaten onder de kopjes 
                  ‘Opleidingen, diploma’s en certificaten’ en ‘Relevante werkervaring’.
                </p>
                <ul className="list-disc space-y-1 pl-5 text-black marker:text-evc-blue-700">
                  <li>Omschrijf per competentie wat je hebt gedaan en lever <strong>minimaal één bewijsstuk</strong> aan dat aantoont dat je die competentie beheerst.</li>
                  <li>
                    Werk bij voorkeur met <strong>STARR-verslagen</strong> (Situatie, Taak, Actie, Resultaat, Reflectie). Gebruik het STARR-formulier.
                    {' '}
                    {materials.starr ? (
                      <a
                        href={materials.starr}
                        target ="_blank"
                        rel ="noopener noreferrer"
                        download="STARR-formulier.pdf"
                        className="text-brand-600 font-semibold cursor-pointer hover:underline"
                      >
                        Download STARR-formulier
                      </a>
                    ) : null}
                  </li>
                  <li>Upload verslagen en bewijzen bij een <strong>relevante competentie</strong>. Heb je een algemeen document? Plaats dit bij <strong>‘Overige informatie en documenten’</strong>.</li>
                  <li>Vul daarnaast je relevante opleidingen, diploma’s, certificaten en werkervaring aan in je profiel en/of portfolio.</li>
                </ul>
                <div className="mt-2 pl-4 text-[15px] text-slate-700">
                  <p>
                    Raadpleeg ook het document ‘VRAAK-Criteria’ voor voorbeelden van toelaatbare bewijsstukken. Vraag dit document op via Berichten als je het niet kunt vinden.
                    {' '}
                    {materials.vraak ? (
                      <a
                        href={materials.vraak}
                        target ="_blank"
                        rel ="noopener noreferrer"                        
                        download="VRAAK-criteria-PBMZ.pdf"
                        className="text-brand-600 font-semibold cursor-pointer hover:underline"
                      >
                        Download VRAAK-criteria bestand
                      </a>
                    ) : null}
                  </p>
                </div>
              </div>

              {/* Bestandsnamen */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Bestandsnamen en -formaten</p>
                <ul className="list-disc space-y-1 pl-5 text-black marker:text-evc-blue-700">
                  <li>
                    Gebruik voor vakinhoudelijke documenten deze structuur: <strong>CODE - Naam - (d-m-jjjj)</strong>. 
                    Voorbeelden:
                    <div className="mt-1 pl-4 text-[15px] text-slate-700">
                      <p>B1-K1-W6 - Verslag Handelt in onvoorziene en/of crisissituaties - (17-4-2025)</p>
                      <p>B1-K1-W6 - Evaluatieverslag - (13-1-2025)</p>
                      <p>B1-K1-W6 - Plan van aanpak - (18-2-2025)</p>
                    </div>
                  </li>
                  <li>Upload bij voorkeur als <strong>PDF</strong>. Foto’s/video’s? Voeg ook een korte PDF toe met toelichting.</li>
                  <li>Andere documenten (zoals authenticiteitsverklaring of werkovereenkomst): geef een duidelijke titel die precies de inhoud weergeeft.</li>
                </ul>
              </div>

              {/* Privacy */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Privacy (AVG)</p>
                <p>Plaats geen persoonsgegevens van anderen zonder toestemming. Anonimiseer gegevens zodat personen niet herkenbaar zijn.</p>
              </div>

              {/* Keuzedelen */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Keuzedelen (alleen MBO)</p>
                <ul className="list-disc space-y-1 pl-5 text-black marker:text-evc-blue-700">
                  <li>Kies in totaal ten minste 720 uur aan keuzedelen (wij raden aan om meer dan 720 uur te kiezen).</li>
                  <li>Lever voor keuzedelen dezelfde soorten verslagen en bewijsstukken aan als voor het basisgedeelte.</li>
                  <li>Geef je gekozen keuzedelen door aan je begeleider via Berichten (Contact).</li>
                </ul>
                <div className="mt-2 pl-4 text-[15px] text-slate-700">
                  <p>De keuzedelenlijst voor ‘Persoonlijk Begeleider Maatschappelijke Zorg’ is op te vragen via Berichten of te vinden in de bijlagen.</p>
                </div>
              </div>

              {/* Authenticiteitsverklaring */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Authenticiteitsverklaring</p>
                <ul className="list-disc space-y-1 pl-5 text-black marker:text-evc-blue-700">
                  <li>Vermeld alle ingeleverde bewijsstukken op de verklaring (voeg zelf regels toe indien nodig).</li>
                  <li>Onderteken met een <strong>‘natte’ handtekening</strong> en upload als <strong>PDF</strong>.</li>
                  <li>Upload bij een relevante competentie of algemene sectie (‘Overige informatie en documenten’) indien beschikbaar.</li>
                  <li>Zorg dat de titels op de verklaring exact overeenkomen met de titels van je uploads in dit portfolio.</li>
                </ul>
                <div className="mt-2 pl-4 text-[15px] text-slate-700">
                  <p>
                    Je kunt de authenticiteitsverklaring downloaden via de materialen van je traject of opvragen via Berichten (Contact).
                    {' '}
                    {materials.auth ? (
                      <a
                        href={materials.auth}
                        target ="_blank"
                        rel ="noopener noreferrer"
                        download="Authenticiteitsverklaring.pdf"
                        className="text-brand-600 font-semibold cursor-pointer hover:underline"
                      >
                        Download Authenticiteitsverklaring
                      </a>
                    ) : null}
                  </p>
                </div>
              </div>

              {/* Feedback */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Feedback en contact</p>
                <ul className="list-disc space-y-1 pl-5 text-black marker:text-evc-blue-700">
                  <li>Je portfoliobegeleider reageert doorgaans binnen drie werkdagen.</li>
                  <li>Vraag actief om feedback via Berichten; de begeleider kijkt niet uit zichzelf in je portfolio.</li>
                  <li>Verwerk ontvangen feedback vóórdat je je portfolio als ‘klaar’ wilt laten aanmerken.</li>
                  <li>Je begeleider ondersteunt je; de <strong>assessor</strong> beoordeelt uiteindelijk je portfolio.</li>
                </ul>
              </div>

              {/* Checklist */}
              <div className="space-y-3">
                <p className="text-lg font-semibold text-evc-blue-800 font-[Poppins]">Checklist vóór je afrondt</p>
                <ol className="list-decimal space-y-1 pl-5 text-black marker:text-evc-blue-700">
                  <li>Vrijwillige deelname aangevinkt.</li>
                  <li>Profielfoto toegevoegd.</li>
                  <li>Relevante werkervaring, opleidingen en certificaten toegevoegd.</li>
                  <li>Loopbaandoel ingevuld.</li>
                  <li>Vragenlijst Loopbaan en Burgerschap ingevuld.</li>
                  <li>Feedback van je begeleider verwerkt.</li>
                  <li>Alle documenten als PDF geüpload en duidelijk benoemd.</li>
                </ol>
              </div>

              {/* Slotblok */}
              <div className="rounded-xl border border-evc-blue-200 bg-white/85 p-4 text-[16px] text-evc-blue-900 font-medium">
                Heb je hulp nodig of twijfel je over je bewijs? Stuur je begeleider een bericht via de pagina Berichten.
              </div>
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
          <h2 className="text-xl font-semibold text-slate-900">Afdekking competenties</h2>
          <p className="max-w-2xl text-sm text-slate-500">
            Per competentie: korte omschrijving, indicatoren en gewenst resultaat. Upload bewijs of koppel items uit je profiel.
            {coach ? ` Je begeleider ${coach.name} kijkt mee en geeft feedback.` : ""}
          </p>
        </header>

        <div className="space-y-3">
          {competencies.map((item, index) => {
            const key = item.id || item.code || String(index);
            const isExpanded = expandedIds.includes(key);
            const uploads = getUploadsFor(item, key);
            const detailId = `competency-${key}`;

            return (
              <article
                key={key}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => toggleCompetency(key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={isExpanded}
                  aria-controls={detailId}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">

                      {item.groupTitle ? (
                        <span className="text-[0.55rem] uppercase tracking-[0.25em] text-slate-400">
                          {item.groupTitle}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-xl font-semibold leading-tight text-slate-900">
                      {item.code ? `${item.code} - ${item.name || item.title}` : item.name || item.title || "Onbenoemde competentie"}
                    </h3>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition">
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <div
                  id={detailId}
                  className={`border-t border-slate-100 px-5 transition-[max-height] duration-500 ${
                    isExpanded ? "max-h-[9999px] overflow-visible py-5" : "max-h-0 overflow-hidden"
                  }`}
                >
                  {isExpanded ? (
                    <div className="space-y-6 text-xs text-slate-500">
                      {item.description ? (
                        <div className="space-y-2">
                          <h4 className="text-lg font-semibold leading-tight text-slate-700">
                            Korte omschrijving
                          </h4>
                          <p className="text-sm font-medium leading-relaxed text-slate-800">{item.description}</p>
                        </div>
                      ) : null}

                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="text-lg font-semibold leading-tight text-slate-700">
                              Wat wordt er van je verwacht?
                            </h4>
                            {renderBulletList(item.expectations, "Nog geen verwachtingen vastgelegd.", "xs")}
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-lg font-semibold leading-tight text-slate-700">
                              Vakkennis en vaardigheden
                            </h4>
                            {renderBulletList(item.subjectKnowledge, "Nog geen vakkennis vastgelegd.", "xs")}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="text-lg font-semibold leading-tight text-slate-700">
                              Gedragscomponenten
                            </h4>
                            {renderBulletList(item.behavioralComponents, "Nog geen gedragscomponenten vastgelegd.", "xs")}
                          </div>
                          <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-slate-600">
                            <p className="text-lg font-semibold leading-tight text-slate-700">
                              Gewenst resultaat
                            </p>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
                              {item.desiredOutcome || "Nog niet vastgelegd."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-lg font-semibold leading-tight text-slate-700">
                          Bewijsstukken
                        </h4>
                        {/* Gekoppeld uit profiel */}
                        {(linkedByCompetency[key] || []).length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-slate-500">Gekoppeld uit profiel</p>
                            <ul className="space-y-2 text-xs text-slate-600">
                              {linkedByCompetency[key].map((entry) => (
                                <li key={`${entry.__section}-${entry.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-slate-700">{entry.title || entry.role || entry.organisation || "Profielitem"}</p>
                                    {entry.__section === "certificate" && entry.filePath ? (
                                      <a href={entry.filePath} target="_blank" rel="noreferrer" className="text-[0.65rem] text-brand-600 hover:text-brand-500">Bekijk</a>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleUnlink(key, entry)}
                                    disabled={!isEditable}
                                    className="rounded-full border border-slate-200 px-3 py-1 text-[0.65rem] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                  >
                                    Ontkoppel
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {uploads.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-400">
                            Nog geen bestanden. Klik op "Voeg upload toe" om te starten.
                          </p>
                        ) : (
                          <ul className="space-y-2 text-xs text-slate-600">
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
                                    <p className="truncate text-xs font-semibold text-slate-700">
                                      {upload.displayName || upload.name || upload.fileName}
                                    </p>
                                    {upload.uploadedAt ? (
                                      <p className="mt-0.5 text-[0.65rem] text-slate-400">
                                        Geüpload op {upload.uploadedAt.toLocaleString()}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="ml-auto flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUnlinkUpload(upload)}
                                      disabled={!isEditable || unlinkingUploadId === upload.id}
                                      className="whitespace-nowrap rounded-full border border-amber-200 px-3 py-1 text-[0.65rem] font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                                    >
                                      {unlinkingUploadId === upload.id ? "Bezig..." : "Ontkoppel"}
                                    </button>
                                    <button
                                      type="button"
                                      className="whitespace-nowrap rounded-full border border-brand-200 px-3 py-1 text-[0.65rem] font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
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
                                      disabled={!isEditable || deletingUploadId === upload.id}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-500 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                                      aria-label="Verwijder upload"
                                    >
                                      {deletingUploadId === upload.id ? (
                                        <span className="text-[9px] font-semibold uppercase tracking-wide">Wacht</span>
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
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
                            <label className="text-lg font-semibold leading-tight text-slate-700">
                              Naam van je upload
                            </label>
                            <input
                              type="text"
                              value={uploadNames[key] || ""}
                              onChange={(event) => handleUploadNameChange(key, event.target.value)}
                              placeholder="Bijvoorbeeld: Reflectieverslag week 3"
                              className={`mt-2 w-full rounded-full border px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                                uploadNameErrors[key]
                                  ? "border-red-300 focus:ring-red-300"
                                  : "border-slate-200 focus:border-brand-400"
                              }`}
                            />
                            {uploadNameErrors[key] ? (
                              <p className="mt-1 text-[0.65rem] text-red-500">{uploadNameErrors[key]}</p>
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
                          {/* Koppelen uit profiel */}
                          <div className="grid gap-2 sm:grid-cols-[1fr,auto] sm:items-center">
                            <select
                              className="w-full rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 focus:border-brand-400 focus:outline-none"
                              value={linkSelections[key] || ""}
                              onChange={(e) => handleLinkSelect(key, e.target.value)}
                              disabled={!isEditable}
                            >
                              <option value="">Koppel item uit profiel…</option>
                              {(resume.educationItems || []).map((ed) => (
                                <option key={`edi-${ed.id}`} value={`educationItems|${ed.id}`}>Opleiding/cursus: {ed.title}</option>
                              ))}
                              {(resume.workExperience || []).map((we) => (
                                <option key={`we-${we.id}`} value={`work|${we.id}`}>Werkervaring: {we.role || we.organisation || we.id}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleTriggerUpload(key)}
                              disabled={!isEditable || uploading === (item.id || item.code || key)}
                              className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-300 px-3 py-2 text-[0.7rem] font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                            >
                              <Paperclip className="h-4 w-4" />
                              {uploading === (item.id || item.code || key) ? "Bezig..." : "Voeg upload toe"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-[0.7rem] text-slate-500">
                        <MessageCircle className="mt-0.5 h-4 w-4 text-brand-500" />
                        <span className="leading-relaxed">
                          Heb je vragen? Laat een bericht achter bij je begeleider in het berichtenoverzicht.
                        </span>
                      </div>
                    </div>
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
