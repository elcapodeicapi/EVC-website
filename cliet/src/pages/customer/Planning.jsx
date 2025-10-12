import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Paperclip, MessageCircle, CheckCircle2 } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import { get, postForm } from "../../lib/api";

const CustomerPlanning = () => {
  const { customer, coach } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planning, setPlanning] = useState({ traject: null, competencies: [] });
  const [uploading, setUploading] = useState(null);
  const fileInputsRef = useRef({});

  const loadPlanning = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get("/customer/planning");
      setPlanning({
        traject: data?.traject || null,
        competencies: Array.isArray(data?.competencies) ? data.competencies : [],
      });
    } catch (err) {
      setError(err?.data?.error || err?.message || "Kon planning niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlanning();
  }, [loadPlanning]);

  const handleTriggerUpload = (competencyId) => {
    const input = fileInputsRef.current[competencyId];
    if (input) {
      input.click();
    }
  };

  const handleUpload = async (competencyId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    const trajectId = planning.traject?.id || "";
    if (!trajectId) {
      setError("Er is geen traject gekoppeld aan dit account.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name);
    formData.append("trajectId", trajectId);
    formData.append("competencyId", competencyId);

    setUploading(competencyId);
    setError(null);
    try {
      await postForm("/evidence/upload", formData);
      await loadPlanning();
    } catch (err) {
      setError(err?.data?.error || err?.message || "Uploaden mislukt");
    } finally {
      setUploading(null);
    }
  };

  const competencies = useMemo(() => planning.competencies || [], [planning.competencies]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Planning</p>
        <h1 className="text-3xl font-semibold text-slate-900">Jouw competenties en bewijsstukken</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Bekijk welke competenties onderdeel zijn van je traject en voeg eenvoudig nieuwe bewijsstukken toe.
          {coach ? ` Je coach ${coach.name} kijkt mee en geeft feedback.` : ""}
        </p>
        {planning.traject ? (
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Traject: {planning.traject.name}
          </p>
        ) : null}
      </header>

      {loading ? <LoadingSpinner label="Planning laden" /> : null}
      {error && !loading ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        {!loading && competencies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-400">
            Er zijn nog geen competenties gekoppeld aan jouw traject.
          </div>
        ) : (
          competencies.map((item, index) => (
            <article key={item.id || item.code || index} className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Competentie</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{item.title || item.code}</h2>
                  <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
                  <CheckCircle2 className="h-4 w-4" /> Actief
                </span>
              </div>

              <div className="space-y-3 rounded-2xl bg-slate-50 px-4 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploads ({item.uploads?.length ?? 0})</h3>
                {!item.uploads || item.uploads.length === 0 ? (
                  <p className="text-sm text-slate-400">Nog geen bestanden. Klik op "Voeg upload toe" om te starten.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-600">
                    {item.uploads.map((upload) => (
                      <li key={upload.id || upload.name} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm">
                        <Paperclip className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{upload.name}</span>
                        <button
                          type="button"
                          className="ml-auto text-xs font-semibold text-brand-600 hover:text-brand-500"
                          onClick={() => upload.filePath ? window.open(upload.filePath, "_blank") : null}
                        >
                          {upload.filePath ? "Download" : "Bekijk"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <input
                    ref={(node) => {
                      if (node) {
                        fileInputsRef.current[item.id] = node;
                      } else {
                        delete fileInputsRef.current[item.id];
                      }
                    }}
                    type="file"
                    className="hidden"
                    onChange={(event) => handleUpload(item.id, event)}
                  />
                  <button
                    type="button"
                    onClick={() => handleTriggerUpload(item.id)}
                    disabled={uploading === item.id}
                    className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-300 px-3 py-2 text-xs font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                  >
                    <Paperclip className="h-4 w-4" /> {uploading === item.id ? "Bezig..." : "Voeg upload toe"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-500 shadow-inner">
                <MessageCircle className="h-4 w-4 text-brand-500" />
                <span className="leading-relaxed">
                  Heb je vragen? Laat een bericht achter bij je coach in het berichtenoverzicht.
                </span>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
};

export default CustomerPlanning;
