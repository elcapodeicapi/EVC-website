import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, Save, TriangleAlert } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import { get, put } from "../../lib/api";

const instructionSections = [
  {
    title: "Ambitie: wat wil je nog bereiken?",
    body:
      "Bedenk hoe je hoopt dat jouw loopbaan er de komende jaren uit gaat zien. Wat wil je nog bereiken in je werk? Wat wil je leren, of wat wil je nooit meer doen? Denk hier even goed over na, want dit zijn vaak moeilijke vragen.",
  },
  {
    title: "Motivatie: wat verwacht je van dit traject?",
    body:
      "Bedenk naast jouw algemene ambitie, waarom je specifiek aan dit EVC-traject meedoet en wat je er van hoopt en verwacht.",
  },
];

const CustomerCareerGoal = () => {
  const { customer } = useOutletContext();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const displayName = customer?.name || "kandidaat";

  useEffect(() => {
    let active = true;
    const loadCareerGoal = async () => {
      setLoading(true);
      try {
        const data = await get("/customer/career-goal");
        if (!active) return;
        setContent(typeof data?.content === "string" ? data.content : "");
        setUpdatedAt(data?.updatedAt || null);
        setStatus(null);
      } catch (error) {
        if (active) {
          setStatus({
            type: "error",
            message: error?.data?.error || error?.message || "Kon loopbaandoel niet laden",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadCareerGoal();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const data = await put("/customer/career-goal", { content });
      setContent(typeof data?.content === "string" ? data.content : "");
      setUpdatedAt(data?.updatedAt || null);
      setStatus({ type: "success", message: "Loopbaandoel opgeslagen" });
    } catch (error) {
      setStatus({ type: "error", message: error?.data?.error || error?.message || "Opslaan mislukt" });
    } finally {
      setSaving(false);
    }
  };

  const StatusBanner = ({ state, className = "" }) => {
    if (!state?.message) return null;
    const isError = state.type === "error";
    const Icon = isError ? TriangleAlert : CheckCircle2;
    const tone = isError
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
    return (
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${tone} ${className}`.trim()}>
        <Icon className="h-4 w-4" />
        <span>{state.message}</span>
      </div>
    );
  };

  const lastUpdatedLabel = () => {
    if (!updatedAt) return null;
    const parsed = new Date(updatedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString();
  };
  const lastUpdatedDisplay = lastUpdatedLabel();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Mijn loopbaandoel</p>
        <h1 className="text-3xl font-semibold text-slate-900">Jouw ambitie in kaart</h1>
        <div className="max-w-2xl space-y-4 text-sm text-slate-500">
          {instructionSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="font-semibold text-slate-700">{section.title}</p>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
        {lastUpdatedDisplay ? (
          <p className="text-xs text-slate-400">Laatst bijgewerkt op {lastUpdatedDisplay}</p>
        ) : null}
      </header>

      <section className="space-y-6">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label htmlFor="careerGoal" className="block text-sm font-semibold text-slate-800">
            Loopbaandoel van {displayName}
          </label>
          <p className="mt-2 text-sm text-slate-500">
            Beschrijf je ambitie: welke stappen wil je zetten binnen je loopbaan en waarom past dit traject bij jou?
          </p>
          {loading ? (
            <div className="mt-6 flex justify-center">
              <LoadingSpinner label="Loopbaandoel laden" />
            </div>
          ) : (
            <textarea
              id="careerGoal"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={12}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
            />
          )}
        </article>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-full bg-evc-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-evc-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
          <StatusBanner state={status} className="w-full sm:w-auto" />
        </div>
      </section>
    </div>
  );
};

export default CustomerCareerGoal;
