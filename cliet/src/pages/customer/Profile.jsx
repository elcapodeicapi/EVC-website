import React, { useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Mail, Phone, MapPin, GraduationCap, Upload, Trash2, Download } from "lucide-react";
import { customerProfileDetails } from "../../data/mockData";

const CustomerProfile = () => {
  const { customer, coach } = useOutletContext();
  const profile = customerProfileDetails;

  const isCurrentCustomer = customer?.id === profile.id;
  const display = useMemo(
    () => (isCurrentCustomer ? { ...profile, name: customer.name, email: customer.email } : profile),
    [customer?.email, customer?.name, isCurrentCustomer, profile]
  );

  const [documents, setDocuments] = useState(display.documents ?? []);
  const fileInputRef = useRef(null);

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes) => {
    if (typeof bytes !== "number") {
      return bytes || "";
    }

    const units = ["B", "kB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size % 1 === 0 ? size : size.toFixed(1)} ${units[unitIndex]}`;
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const uploadedAt = new Date().toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    setDocuments((previous) => [
      ...previous,
      ...files.map((file) => ({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        size: formatFileSize(file.size),
        uploadedAt,
        file,
      })),
    ]);

    event.target.value = "";
  };

  const handleDeleteDocument = (id) => {
    setDocuments((previous) => previous.filter((document) => document.id !== id));
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Profiel</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">{display.name}</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-500">{display.headline}</p>
        </div>
        {coach ? (
          <div className="rounded-3xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700 shadow-sm">
            Begeleid door <strong>{coach.name}</strong>
          </div>
        ) : null}
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contact</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-brand-500" />
                <a href={`mailto:${display.email}`} className="hover:text-brand-600">
                  {display.email}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-brand-500" />
                <span>{display.phone}</span>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-brand-500" />
                <span>{display.location}</span>
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Over mij</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{display.about}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Certificaten</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {display.certificates.map((certificate) => (
                <li key={certificate.id} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                  <GraduationCap className="mt-0.5 h-4 w-4 text-brand-500" />
                  <div>
                    <p className="font-semibold text-slate-900">{certificate.title}</p>
                    <p className="text-xs text-slate-500">
                      {certificate.issuer} • {certificate.year}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Documenten</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Upload relevante documenten als bewijs of ondersteuning van je traject.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={triggerFileDialog}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
                >
                  <Upload className="h-4 w-4" /> Upload document
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              {documents.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-400">
                  Nog geen documenten geüpload.
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 text-sm text-slate-600">
                  {documents.map((document) => (
                    <li key={document.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-slate-900">{document.name}</span>
                        <span className="text-xs text-slate-400">
                          {document.size ? document.size : ""}
                          {document.uploadedAt ? ` • Geüpload op ${document.uploadedAt}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600"
                          onClick={() => alert("Mock download")}
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          onClick={() => handleDeleteDocument(document.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Verwijderen
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </main>
      </section>
    </div>
  );
};

export default CustomerProfile;
