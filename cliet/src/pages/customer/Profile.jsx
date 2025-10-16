import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { get, postForm, put } from "../../lib/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { CheckCircle2, TriangleAlert } from "lucide-react";

const initialFormState = {
  dateOfBirth: "",
  placeOfBirth: "",
  nationality: "",
  phoneFixed: "",
  phoneMobile: "",
  street: "",
  houseNumber: "",
  addition: "",
  postalCode: "",
  city: "",
  email: "",
  name: "",
  educations: [],
  certificates: [],
  workExperience: [],
};

const CustomerProfile = () => {
  const { customer, coach } = useOutletContext();
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [educationDraft, setEducationDraft] = useState({ title: "", institution: "", startDate: "", endDate: "", note: "" });
  const [workDraft, setWorkDraft] = useState({ role: "", organisation: "", startDate: "", endDate: "", note: "" });
  const [certificateDraft, setCertificateDraft] = useState({ title: "", note: "", file: null });
  const [certificateUploading, setCertificateUploading] = useState(false);
  const [certificateStatus, setCertificateStatus] = useState(null);
  const [certificateInputKey, setCertificateInputKey] = useState(0);

  const customerName = useMemo(() => customer?.name || form.name || "Jouw profiel", [customer?.name, form.name]);
  const emailAddress = form.email || customer?.email || "";

  const createId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  };

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const data = await get("/customer/profile");
        if (!active) return;
        setForm((prev) => ({ ...prev, ...data }));
      } catch (error) {
        if (!active) return;
        setStatus({ type: "error", message: error?.data?.error || error?.message || "Kon profiel niet laden" });
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const payload = {
        dateOfBirth: form.dateOfBirth,
        placeOfBirth: form.placeOfBirth,
        nationality: form.nationality,
        phoneFixed: form.phoneFixed,
        phoneMobile: form.phoneMobile,
        street: form.street,
        houseNumber: form.houseNumber,
        addition: form.addition,
        postalCode: form.postalCode,
        city: form.city,
        educations: form.educations || [],
        certificates: (form.certificates || []).map(({ id, title, filePath, fileName, size, uploadedAt, note }) => ({
          id,
          title,
          filePath,
          fileName,
          size,
          uploadedAt,
          note,
        })),
        workExperience: form.workExperience || [],
      };

      const data = await put("/customer/profile", payload);
      setForm((prev) => ({ ...prev, ...data }));
      setStatus({ type: "success", message: "Wijzigingen opgeslagen" });
    } catch (error) {
      setStatus({ type: "error", message: error?.data?.error || error?.message || "Opslaan mislukt" });
    } finally {
      setSaving(false);
    }
  };

  const StatusBanner = ({ state }) => {
    if (!state?.message) return null;
    const isError = state.type === "error";
    const Icon = isError ? TriangleAlert : CheckCircle2;
    const color = isError
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

    return (
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${color}`}>
        <Icon className="h-4 w-4" />
        <span>{state.message}</span>
      </div>
    );
  };

  const handleRemoveItem = (key, id) => {
    setForm((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((item) => item.id !== id),
    }));
  };

  const addEducation = () => {
    if (!educationDraft.title.trim()) {
      setStatus({ type: "error", message: "Voeg minimaal een titel toe voor je opleiding." });
      return;
    }
    const entry = {
      id: createId(),
      title: educationDraft.title.trim(),
      institution: educationDraft.institution.trim(),
      startDate: educationDraft.startDate || "",
      endDate: educationDraft.endDate || "",
      note: educationDraft.note.trim(),
    };
    setForm((prev) => ({
      ...prev,
      educations: [...(prev.educations || []), entry],
    }));
    setEducationDraft({ title: "", institution: "", startDate: "", endDate: "", note: "" });
  };

  const addWorkExperience = () => {
    if (!workDraft.role.trim() && !workDraft.organisation.trim() && !workDraft.note.trim()) {
      setStatus({ type: "error", message: "Vul minimaal een functie, organisatie of toelichting in." });
      return;
    }
    const entry = {
      id: createId(),
      role: workDraft.role.trim(),
      organisation: workDraft.organisation.trim(),
      startDate: workDraft.startDate || "",
      endDate: workDraft.endDate || "",
      note: workDraft.note.trim(),
    };
    setForm((prev) => ({
      ...prev,
      workExperience: [...(prev.workExperience || []), entry],
    }));
    setWorkDraft({ role: "", organisation: "", startDate: "", endDate: "", note: "" });
  };

  const handleCertificateFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setCertificateDraft((prev) => ({ ...prev, file }));
  };

  const addCertificate = async () => {
    if (!certificateDraft.file) {
      setCertificateStatus({ type: "error", message: "Kies eerst een bestand." });
      return;
    }

    const title = certificateDraft.title.trim() || certificateDraft.file.name;
    setCertificateUploading(true);
    setCertificateStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", certificateDraft.file);
      const upload = await postForm("/customer/profile/certificates/upload", formData);

      const entry = {
        id: createId(),
        title,
        filePath: upload.filePath,
        fileName: upload.fileName || certificateDraft.file.name,
        size: upload.size,
        uploadedAt: upload.uploadedAt,
        note: certificateDraft.note.trim(),
      };

      setForm((prev) => ({
        ...prev,
        certificates: [...(prev.certificates || []), entry],
      }));
      setCertificateDraft({ title: "", note: "", file: null });
      setCertificateInputKey((value) => value + 1);
      setCertificateStatus({ type: "success", message: "Certificaat toegevoegd" });
    } catch (error) {
      setCertificateStatus({ type: "error", message: error?.data?.error || error?.message || "Upload mislukt" });
    } finally {
      setCertificateUploading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Profiel laden" />;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-500">Mijn profiel</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Profiel {customerName}</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-500">
            Dit is de pagina waar je jouw persoonlijke gegevens kunt inzien en eventueel aanpassen.
          </p>
        </div>
        {coach ? (
          <div className="rounded-3xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700 shadow-sm">
            Begeleid door <strong>{coach.name}</strong>
          </div>
        ) : null}
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <StatusBanner state={status} />

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
            <div className="space-y-8">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Persoonsgegevens</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <label htmlFor="dateOfBirth" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Geboortedatum
                    </label>
                    <input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={form.dateOfBirth || ""}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="placeOfBirth" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Geboorteplaats
                    </label>
                    <input
                      id="placeOfBirth"
                      name="placeOfBirth"
                      value={form.placeOfBirth || ""}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      placeholder="Bijvoorbeeld: Alkmaar"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="nationality" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Nationaliteit
                    </label>
                    <input
                      id="nationality"
                      name="nationality"
                      value={form.nationality || ""}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      placeholder="Bijvoorbeeld: NL"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">Contactgegevens</h2>
                  <button
                    type="button"
                    onClick={() => alert("Vraag je beheerder om je wachtwoord te wijzigen.")}
                    className="text-sm font-semibold text-brand-600 transition hover:text-brand-500"
                  >
                    Wachtwoord wijzigen
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label htmlFor="phoneFixed" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Telefoonnummer (vast)
                    </label>
                    <input
                      id="phoneFixed"
                      name="phoneFixed"
                      value={form.phoneFixed || ""}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      placeholder="Bijvoorbeeld: 0201234567"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="phoneMobile" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Telefoonnummer (mobiel)
                    </label>
                    <input
                      id="phoneMobile"
                      name="phoneMobile"
                      value={form.phoneMobile || ""}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      placeholder="Bijvoorbeeld: 0612345678"
                    />
                  </div>
                  <div className="md:col-span-2 grid gap-2">
                    <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      E-mailadres
                    </label>
                    <input
                      id="email"
                      name="email"
                      value={emailAddress}
                      readOnly
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 shadow-inner"
                    />
                    <p className="text-xs text-slate-400">Het e-mailadres wordt beheerd door je organisatie.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 rounded-2xl bg-slate-50 p-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Adresgegevens</h2>
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="street" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Straatnaam
                    </label>
                    <input
                      id="street"
                      name="street"
                      value={form.street || ""}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr,0.8fr]">
                    <div className="grid gap-2">
                      <label htmlFor="houseNumber" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Huisnummer
                      </label>
                      <input
                        id="houseNumber"
                        name="houseNumber"
                        value={form.houseNumber || ""}
                        onChange={handleChange}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="addition" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Toevoeging
                      </label>
                      <input
                        id="addition"
                        name="addition"
                        value={form.addition || ""}
                        onChange={handleChange}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="postalCode" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Postcode
                    </label>
                    <input
                      id="postalCode"
                      name="postalCode"
                      value={form.postalCode || ""}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      placeholder="Bijv. 1822 BW"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="city" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Woonplaats
                    </label>
                    <input
                      id="city"
                      name="city"
                      value={form.city || ""}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Downloads</h3>
                <button
                  type="button"
                  onClick={() => alert("Download van profiel volgt later in de productieroute.")}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-inner transition hover:text-brand-600"
                >
                  ⬇️ Download mijn profiel
                </button>
                <button
                  type="button"
                  onClick={() => alert("Document downloads zijn binnenkort beschikbaar.")}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-inner transition hover:text-brand-600"
                >
                  ⬇️ Download mijn documenten
                </button>
                <button
                  type="button"
                  onClick={() => alert("Zelfevaluatie download is nog niet beschikbaar.")}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-inner transition hover:text-brand-600"
                >
                  ⬇️ Download mijn zelfevaluatie
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Opleidingen</h2>
                <p className="mt-2 text-sm text-slate-500">Leg je afgeronde of lopende opleidingen vast inclusief toelichting.</p>
              </div>
              <div className="space-y-4">
                {(form.educations || []).length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Nog geen opleidingen toegevoegd.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {form.educations.map((education) => (
                      <li
                        key={education.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">{education.title}</p>
                            {education.institution ? (
                              <p className="text-xs uppercase tracking-wide text-slate-400">{education.institution}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem("educations", education.id)}
                            className="text-xs font-semibold text-brand-600 transition hover:text-brand-500"
                          >
                            Verwijder
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                          {education.startDate ? <span>Start: {education.startDate}</span> : null}
                          {education.endDate ? <span>Einde: {education.endDate}</span> : null}
                        </div>
                        {education.note ? (
                          <p className="mt-2 text-sm text-slate-500">{education.note}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Nieuwe opleiding toevoegen</h3>
                <div className="mt-3 grid gap-3 text-sm">
                  <input
                    type="text"
                    value={educationDraft.title}
                    onChange={(event) => setEducationDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Naam opleiding"
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <input
                    type="text"
                    value={educationDraft.institution}
                    onChange={(event) => setEducationDraft((prev) => ({ ...prev, institution: event.target.value }))}
                    placeholder="Onderwijsinstelling"
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="month"
                      value={educationDraft.startDate}
                      onChange={(event) => setEducationDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                      className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                    <input
                      type="month"
                      value={educationDraft.endDate}
                      onChange={(event) => setEducationDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                      className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <textarea
                    value={educationDraft.note}
                    onChange={(event) => setEducationDraft((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Toelichting"
                    rows={3}
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <button
                    type="button"
                    onClick={addEducation}
                    className="inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
                  >
                    Voeg opleiding toe
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Certificaten &amp; diploma&apos;s</h2>
                <p className="mt-2 text-sm text-slate-500">Upload officiële documenten en voeg een toelichting toe.</p>
              </div>
              <div className="space-y-4">
                {(form.certificates || []).length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Nog geen certificaten geüpload.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {form.certificates.map((certificate) => (
                      <li
                        key={certificate.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">{certificate.title}</p>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                              {certificate.fileName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={certificate.filePath}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-brand-600 transition hover:text-brand-500"
                            >
                              Bekijk
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem("certificates", certificate.id)}
                              className="text-xs font-semibold text-brand-600 transition hover:text-brand-500"
                            >
                              Verwijder
                            </button>
                          </div>
                        </div>
                        {certificate.note ? (
                          <p className="mt-2 text-sm text-slate-500">{certificate.note}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                          {certificate.uploadedAt ? <span>Geüpload: {new Date(certificate.uploadedAt).toLocaleDateString()}</span> : null}
                          {certificate.size ? <span>{(certificate.size / (1024 * 1024)).toFixed(2)} MB</span> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Nieuw certificaat toevoegen</h3>
                <div className="mt-3 grid gap-3 text-sm">
                  <input
                    type="text"
                    value={certificateDraft.title}
                    onChange={(event) => setCertificateDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Titel certificaat of diploma"
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <textarea
                    value={certificateDraft.note}
                    onChange={(event) => setCertificateDraft((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Toelichting"
                    rows={3}
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <input
                    key={certificateInputKey}
                    type="file"
                    onChange={handleCertificateFileChange}
                    className="text-sm"
                  />
                  <button
                    type="button"
                    onClick={addCertificate}
                    disabled={certificateUploading}
                    className="inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
                  >
                    {certificateUploading ? "Bezig met uploaden..." : "Upload en voeg toe"}
                  </button>
                  {certificateStatus ? (
                    <p
                      className={`text-xs ${
                        certificateStatus.type === "error" ? "text-red-500" : "text-emerald-600"
                      }`}
                    >
                      {certificateStatus.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Relevante werkervaring</h2>
              <p className="mt-2 text-sm text-slate-500">Beschrijf je belangrijke werkervaringen en voeg een toelichting toe.</p>
            </div>
            <div className="space-y-4">
              {(form.workExperience || []).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Nog geen werkervaring toegevoegd.
                </p>
              ) : (
                <ul className="space-y-3">
                  {form.workExperience.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.role || "Functie onbekend"}</p>
                          {item.organisation ? (
                            <p className="text-xs uppercase tracking-wide text-slate-400">{item.organisation}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem("workExperience", item.id)}
                          className="text-xs font-semibold text-brand-600 transition hover:text-brand-500"
                        >
                          Verwijder
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                        {item.startDate ? <span>Start: {item.startDate}</span> : null}
                        {item.endDate ? <span>Einde: {item.endDate}</span> : null}
                      </div>
                      {item.note ? (
                        <p className="mt-2 text-sm text-slate-500">{item.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Nieuwe ervaring toevoegen</h3>
              <div className="mt-3 grid gap-3 text-sm">
                <input
                  type="text"
                  value={workDraft.role}
                  onChange={(event) => setWorkDraft((prev) => ({ ...prev, role: event.target.value }))}
                  placeholder="Functietitel"
                  className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <input
                  type="text"
                  value={workDraft.organisation}
                  onChange={(event) => setWorkDraft((prev) => ({ ...prev, organisation: event.target.value }))}
                  placeholder="Organisatie"
                  className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="month"
                    value={workDraft.startDate}
                    onChange={(event) => setWorkDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <input
                    type="month"
                    value={workDraft.endDate}
                    onChange={(event) => setWorkDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <textarea
                  value={workDraft.note}
                  onChange={(event) => setWorkDraft((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="Toelichting"
                  rows={3}
                  className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={addWorkExperience}
                  className="inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
                >
                  Voeg werkervaring toe
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-lime-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:bg-lime-300"
          >
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerProfile;
