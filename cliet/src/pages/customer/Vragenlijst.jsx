import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CircleHelp } from "lucide-react";

const STORAGE_NAMESPACE = "evc-vragenlijst-responses";

const QUESTION_SECTIONS = [
  {
    id: "werknemer",
    title: "De economische dimensie: functioneren als werknemer in een arbeidsorganisatie",
    instruction:
  "Beschrijf hoe u zich als een goede werknemer gedraagt. Vertel bijvoorbeeld hoe u omgaat met collega's, hoe u op de hoogte blijft van regels en procedures, hoe u uw rechten als werknemer kent, of hoe u omgaat met overwerk en stress.",
  },
  {
    id: "politiek",
    title: "Burgerschap: de politiek-juridische dimensie",
    instruction:
      "Vertel hoe u zich een mening vormt over politieke onderwerpen. Geef aan of u stemt bij verkiezingen, hoe u beslist op wie u stemt en welke thema’s u belangrijk vindt in de politiek.",
  },
  {
    id: "consument",
    title: "De economische dimensie: functioneren als kritisch consument",
    instruction:
  "Beschrijf uw gedrag als consument. Vertel hoe u beslissingen neemt over aankopen of het kiezen van een dienstverlener. Denk aan het verzamelen van informatie, letten op aanbiedingen, onderhandelen over prijzen en het bewaken van uw uitgaven.",
  },
  {
    id: "sociaal",
    title: "De sociaal-maatschappelijke dimensie: deelnemen in sociale verbanden",
    instruction:
      "Beschrijf hoe u deelneemt aan sociale verbanden en wat u doet om de leefbaarheid van uw omgeving te versterken. Vertel bijvoorbeeld over vrijwilligerswerk, verenigingen, goede doelen of manieren waarop u anderen helpt.",
  },
  {
    id: "vitaal",
    title: "De dimensie vitaal burgerschap: zorgen voor de eigen gezondheid en die van anderen",
    instruction:
      "Beschrijf hoe u met uw gezondheid omgaat en hoe u rekening houdt met de gezondheid van anderen. Denk aan sport, voeding, stoppen met roken, het zoeken van informatie en weten waar u hulp kunt vinden.",
  },
  {
    id: "loopbaan",
    title: "Loopbaan: sturen van de eigen loopbaan",
    instruction:
      "Vertel hoe u uw loopbaan richting geeft. Beschrijf uw sterke kanten, wat u wilt leren, welke baan goed bij u past en welke stappen u wilt zetten om uw toekomstige doelen te bereiken.",
  },
];

const emptyResponses = QUESTION_SECTIONS.reduce((acc, section) => {
  acc[section.id] = "";
  return acc;
}, {});

const StatusBanner = ({ state, className = "" }) => {
  if (!state) return null;
  const tone = state.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const label = state.type === "error" ? "Opslaan mislukt" : "Opgeslagen";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${tone} ${className}`.trim()}>
      <span className="font-semibold">{label}</span>
      <span className="text-xs text-current/80">{state.message}</span>
    </div>
  );
};

const CustomerVragenlijst = () => {
  const { customer } = useOutletContext() ?? {};
  const customerId = customer?.firebaseUid || customer?.id || customer?.uid || null;
  const storageKey = useMemo(() => (customerId ? `${STORAGE_NAMESPACE}:${customerId}` : null), [customerId]);

  const [responses, setResponses] = useState(emptyResponses);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setResponses((previous) => ({ ...previous, ...parsed }));
      }
    } catch (_) {
      // Ignored: fall back to defaults when parsing fails.
    }
  }, [storageKey]);

  const handleChange = (sectionId) => (event) => {
    const { value } = event.target;
    setResponses((previous) => ({ ...previous, [sectionId]: value }));
    setStatus(null);
  };

  const handleSave = () => {
    if (!storageKey) {
      setStatus({ type: "error", message: "Log opnieuw in om uw antwoorden op te slaan." });
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(responses));
      setStatus({ type: "success", message: "Uw antwoorden zijn lokaal opgeslagen op dit apparaat." });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Kon antwoorden niet opslaan." });
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Loopbaan en Burgerschap</p>
        <h1 className="text-3xl font-semibold text-slate-900">Reflecties op uw loopbaan en burgerschap</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Gebruik deze vragenlijst om uw ervaringen en inzichten te delen. Geef bij iedere vraag concrete voorbeelden uit uw dagelijks leven zodat uw begeleider uw situatie goed kan beoordelen. U kunt uw antwoorden tussentijds opslaan en later verder aanvullen.
        </p>
      </header>
      <section className="space-y-6">
        {QUESTION_SECTIONS.map((section) => (
          <article key={section.id} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{section.instruction}</p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-evc-blue-200 hover:text-evc-blue-600"
                aria-label="Toon toelichting"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={responses[section.id] || ""}
              onChange={handleChange(section.id)}
              rows={6}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
              placeholder="Schrijf uw antwoord hier..."
            />
          </article>
        ))}
      </section>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center justify-center rounded-full bg-evc-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-evc-blue-500"
        >
          Opslaan
        </button>
        <StatusBanner state={status} className="w-full sm:w-auto" />
      </div>
      <p className="text-xs text-slate-400">Opgeslagen antwoorden worden alleen lokaal bewaard en zijn zichtbaar op dit apparaat.</p>
    </div>
  );
};

export default CustomerVragenlijst;
