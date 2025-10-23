import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Eagerly import all .txt files as raw strings (Vite: use query + import to avoid deprecation)
const RAW_FILES = import.meta.glob("../../data/*.txt", {
  eager: true,
  query: "?raw",
  import: "default",
});

function detectRole(context) {
  // Coach layout provides resolvedRole; customer layout provides customer; admin via localStorage
  const fromContext = context?.resolvedRole || context?.customer?.role || context?.sqlUser?.role || null;
  if (fromContext) return String(fromContext).toLowerCase();
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    const role = stored?.role ? String(stored.role).toLowerCase() : null;
    if (role) return role;
  } catch (_) {}
  return "customer"; // default to candidate
}

function candidateFilenamesForRole(role) {
  // Primary names required by spec with graceful fallbacks to existing files
  switch (role) {
    case "customer":
    case "kandidaat":
      return [
        "handleiding_kandidaat.txt",
        "Handleiding_kandidaat.txt",
        "Handleiding-customer.txt",
        "Handleiding.txt",
      ];
    case "coach":
    case "begeleider":
      return [
        "handleiding_coach.txt",
        "Handleiding_coach.txt",
        "Handleiding-coach.txt",
        "Handleiding.txt",
      ];
    case "kwaliteitscoordinator":
    case "kwaliteitscoördinator":
    case "kwaco":
      return [
        "handleiding_coach.txt",
        "Handleiding_coach.txt",
        "Handleiding-coach.txt",
        "Handleiding.txt",
      ];
    case "assessor":
      return [
        "handleiding_assessor.txt",
        "Handleiding_assessor.txt",
        "Handleiding-coach.txt",
        "Handleiding.txt",
      ];
    case "admin":
      return [
        "handleiding_admin.txt",
        "Handleiding_admin.txt",
        "Handleiding.txt",
      ];
    default:
      return ["Handleiding.txt"]; 
  }
}

function pickManualContent(role) {
  const files = Object.entries(RAW_FILES).map(([path, content]) => ({ path, name: path.split("/").pop(), content }));
  const candidates = candidateFilenamesForRole(role);
  const found = candidates
    .map((want) => files.find((f) => f.name?.toLowerCase() === want.toLowerCase()))
    .find(Boolean);
  return found || null;
}

// Parse chapters/subsections like "1. Title" and "1.1 Subtitle"
function parseManual(raw) {
  const lines = (raw || "").split(/\r?\n/);
  const sections = [];
  let current = null;
  let currentSub = null;
  const pushLine = (line) => {
    if (currentSub) {
      currentSub.body.push(line);
    } else if (current) {
      current.body.push(line);
    }
  };
  lines.forEach((line) => {
    const l = line.trimEnd();
    const h3 = l.match(/^(\d+)\.(\d+)\.(\d+)\.?\s+(.+)$/);
    const h2 = l.match(/^(\d+)\.(\d+)\.?\s+(.+)$/);
    const h1 = l.match(/^(\d+)\.?\s+(.+)$/);
    if (h3) {
      const num = `${h3[1]}.${h3[2]}.${h3[3]}`;
      if (!current) {
        current = { id: `sec-${h3[1]}`, number: h3[1], title: `Hoofdstuk ${h3[1]}`, body: [], children: [] };
        sections.push(current);
      }
      if (!currentSub || currentSub.number !== `${h3[1]}.${h3[2]}`) {
        currentSub = { id: `sec-${h3[1]}-${h3[2]}`, number: `${h3[1]}.${h3[2]}`, title: `Paragraaf ${h3[1]}.${h3[2]}`, body: [], children: [] };
        current.children.push(currentSub);
      }
      currentSub.children.push({ id: `sec-${num.replaceAll(".", "-")}`, number: num, title: h3[4], body: [] });
      // Point currentSub to last child to accumulate body
      currentSub = currentSub.children[currentSub.children.length - 1];
    } else if (h2) {
      // New subsection under current chapter
      const num = `${h2[1]}.${h2[2]}`;
      if (!current || current.number !== h2[1]) {
        current = { id: `sec-${h2[1]}`, number: h2[1], title: `Hoofdstuk ${h2[1]}`, body: [], children: [] };
        sections.push(current);
      }
      currentSub = { id: `sec-${h2[1]}-${h2[2]}`, number: num, title: h2[3], body: [], children: [] };
      current.children.push(currentSub);
    } else if (h1) {
      // New chapter
      current = { id: `sec-${h1[1]}`, number: h1[1], title: h1[2], body: [], children: [] };
      sections.push(current);
      currentSub = null;
    } else {
      pushLine(l);
    }
  });
  // Trim extraneous blank lines
  const trimBody = (arr) => arr.map((s) => ({
    ...s,
    body: (s.body || [])
      .join("\n")
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/\u00A0/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .split(/\n/)
      .map((line) => line.trimEnd())
      .filter((line, idx, arrLines) => {
        // drop duplicate consecutive lines and stray numbering-only lines
        if (!line) return false;
        if (/^\d+(?:\.\d+){0,2}\.?$/.test(line)) return false;
        return line !== arrLines[idx - 1];
      }),
    children: s.children ? trimBody(s.children) : [],
  }));
  return trimBody(sections);
}

const ManualPage = () => {
  const context = useOutletContext?.() || {};
  const role = detectRole(context);
  const [entry, setEntry] = useState(null);
  const [parsed, setParsed] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    // pick correct file per role
    const chosen = pickManualContent(role);
    setEntry(chosen);
    setParsed(chosen ? parseManual(chosen.content) : []);
  }, [role]);

  const hasContent = Boolean(entry);
  const roleLabel = useMemo(() => {
    switch (role) {
      case "customer":
      case "kandidaat":
        return "Kandidaat";
      case "coach":
      case "begeleider":
        return "Coach";
      case "kwaliteitscoordinator":
      case "kwaliteitscoördinator":
      case "kwaco":
        return "Kwaliteitscoördinator";
      case "assessor":
        return "Assessor";
      case "admin":
        return "Admin";
      default:
        return "Handleiding";
    }
  }, [role]);

  const handleScrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  };

  const handleDownloadPdf = async () => {
    const el = containerRef.current;
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let position = 0;
    let heightLeft = imgHeight;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;
    }
    const filename = (entry?.name || `handleiding_${role}.txt`).replace(/\.txt$/i, ".pdf");
    pdf.save(filename);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Handleiding</p>
          <h1 className="text-3xl font-semibold text-slate-900">{roleLabel}: Handleiding</h1>
          <p className="text-sm text-slate-500">Klik op een onderdeel in de inhoudsopgave om direct te navigeren.</p>
        </div>
        <div>
          {hasContent ? (
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="rounded-full bg-evc-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-evc-blue-500"
            >
              Download als PDF
            </button>
          ) : null}
        </div>
      </header>

      {!hasContent ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            Geen handleiding gevonden voor jouw rol. Voeg een handleiding-bestand toe in <code>cliet/src/data/</code> met naam {candidateFilenamesForRole(role)[0]}.
          </p>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
          {/* TOC */}
          <aside className="sticky top-4 self-start rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Inhoud</p>
            <nav className="mt-2 space-y-1 text-sm">
              {parsed.map((sec) => (
                <div key={sec.id}>
                  <button
                    type="button"
                    onClick={() => handleScrollTo(sec.id)}
                    className="w-full rounded-xl px-2 py-1 text-left font-medium text-slate-700 hover:bg-evc-blue-50 truncate"
                  >
                    {sec.number}. {sec.title}
                  </button>
                  {(sec.children || []).map((sub) => (
                    <div key={sub.id} className="ml-3">
                      <button
                        type="button"
                        onClick={() => handleScrollTo(sub.id)}
                        className="w-full rounded-xl px-2 py-1 text-left text-slate-600 hover:bg-evc-blue-50 truncate"
                      >
                        {sub.number}. {sub.title}
                      </button>
                      {(sub.children || []).map((sub2) => (
                        <button
                          key={sub2.id}
                          type="button"
                          onClick={() => handleScrollTo(sub2.id)}
                          className="ml-6 w-[calc(100%-1.5rem)] rounded-xl px-2 py-1 text-left text-slate-500 hover:bg-evc-blue-50 truncate"
                        >
                          {sub2.number}. {sub2.title}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div ref={containerRef} className="space-y-6">
            {parsed.map((sec) => (
              <section key={sec.id} id={sec.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">
                  {sec.number}. {sec.title}
                </h2>
                {sec.body?.length ? (
                  <article className="prose prose-sm mt-3 max-w-none break-words text-slate-700">
                    {sec.body.map((line, idx) => (
                      <p key={idx} className="whitespace-pre-wrap">{line}</p>
                    ))}
                  </article>
                ) : null}
                {(sec.children || []).map((sub) => (
                  <div key={sub.id} id={sub.id} className="mt-6">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {sub.number}. {sub.title}
                    </h3>
                    {sub.body?.length ? (
                      <article className="prose prose-sm mt-2 max-w-none break-words text-slate-700">
                        {sub.body.map((line, idx) => (
                          <p key={idx} className="whitespace-pre-wrap">{line}</p>
                        ))}
                      </article>
                    ) : null}
                    {(sub.children || []).map((sub2) => (
                      <div key={sub2.id} id={sub2.id} className="mt-4">
                        <h4 className="text-base font-semibold text-slate-800">
                          {sub2.number}. {sub2.title}
                        </h4>
                        {sub2.body?.length ? (
                          <article className="prose prose-sm mt-1 max-w-none break-words text-slate-700">
                            {sub2.body.map((line, idx) => (
                              <p key={idx} className="whitespace-pre-wrap">{line}</p>
                            ))}
                          </article>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualPage;
