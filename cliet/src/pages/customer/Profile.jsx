import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { get, postForm, put } from "../../lib/api";
import { subscribeCustomerProfileDetails, updateCustomerProfileDetails } from "../../lib/firestoreCustomer";
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
  photoURL: "",
};

const initialEvcTrajectoryState = {
  contactPerson: "",
  currentRole: "",
  domains: "",
  qualification: {
    name: "",
    number: "",
    validity: "",
  },
  voluntaryParticipation: false,
  updatedAt: null,
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
  const [evcDetails, setEvcDetails] = useState(initialEvcTrajectoryState);
  const [evcSnapshot, setEvcSnapshot] = useState(initialEvcTrajectoryState);
  const [evcLoading, setEvcLoading] = useState(true);
  const [evcSaving, setEvcSaving] = useState(false);
  const [evcStatus, setEvcStatus] = useState(null);
  const [evcError, setEvcError] = useState(null);
  const [evcEditMode, setEvcEditMode] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoStatus, setPhotoStatus] = useState(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);

  const customerId = customer?.id || customer?.firebaseUid || customer?.uid || null;
  const customerName = useMemo(() => customer?.name || form.name || "Jouw profiel", [customer?.name, form.name]);
  const customerInitials = useMemo(() => {
    const source = customerName || customer?.email || "";
    if (!source) return "??";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase())
      .slice(0, 2)
      .join("") || "??";
  }, [customerName, customer?.email]);
  const emailAddress = form.email || customer?.email || "";

  const createId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  };

  const handleEvcFieldChange = (field) => (event) => {
    const { value } = event.target;
    setEvcDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleQualificationChange = (field) => (event) => {
    const { value } = event.target;
    setEvcDetails((prev) => ({
      ...prev,
      qualification: {
        ...prev.qualification,
        [field]: value,
      },
    }));
  };

  const handleParticipationChange = (event) => {
    const { checked } = event.target;
    setEvcDetails((prev) => ({ ...prev, voluntaryParticipation: checked }));
  };

  const handleEvcCancel = () => {
    setEvcStatus(null);
    setEvcEditMode(false);
    setEvcDetails(evcSnapshot);
  };

  const handleEvcSave = async () => {
    if (!customerId) return;
    setEvcSaving(true);
    setEvcStatus(null);
    try {
      await updateCustomerProfileDetails(customerId, { evcTrajectory: evcDetails });
      setEvcStatus({ type: "success", message: "EVC-trajectgegevens opgeslagen" });
      setEvcEditMode(false);
    } catch (error) {
      setEvcStatus({ type: "error", message: error?.message || "Opslaan mislukt" });
    } finally {
      setEvcSaving(false);
    }
  };

  const handleEvcPrimaryAction = () => {
    if (evcEditMode) {
      if (!evcSaving) {
        handleEvcSave();
      }
      return;
    }
    setEvcStatus(null);
    setEvcDetails(evcSnapshot);
    setEvcEditMode(true);
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

  useEffect(() => {
    if (!customerId) {
      setEvcDetails(initialEvcTrajectoryState);
      setEvcSnapshot(initialEvcTrajectoryState);
      setEvcLoading(false);
      setEvcEditMode(false);
      setEvcStatus(null);
      setEvcError(null);
      return () => {};
    }

    setEvcLoading(true);
    const unsubscribe = subscribeCustomerProfileDetails(customerId, ({ data, error }) => {
      if (error) {
        setEvcError(error);
        setEvcLoading(false);
        return;
      }
      setEvcError(null);
      const trajectory = data?.evcTrajectory || initialEvcTrajectoryState;
      setEvcSnapshot(trajectory);
      if (!evcEditMode) {
        setEvcDetails(trajectory);
      }
      setEvcLoading(false);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customerId, evcEditMode]);

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

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setPhotoStatus({ type: "error", message: "Kies een geldig afbeeldingsbestand (PNG of JPG)." });
      setPhotoInputKey((value) => value + 1);
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      setPhotoStatus({ type: "error", message: "Bestand is groter dan 5MB." });
      setPhotoInputKey((value) => value + 1);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setPhotoUploading(true);
    setPhotoStatus(null);
    try {
      const response = await postForm("/customer/profile/photo", formData);
      setForm((prev) => ({ ...prev, photoURL: response?.photoURL || prev.photoURL }));
      setPhotoStatus({ type: "success", message: "Profielfoto bijgewerkt" });
    } catch (error) {
      setPhotoStatus({ type: "error", message: error?.data?.error || error?.message || "Upload mislukt" });
    } finally {
      setPhotoUploading(false);
      setPhotoInputKey((value) => value + 1);
    }
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-sm">
              {form.photoURL ? (
                <img src={form.photoURL} alt={customerName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-xl font-semibold text-slate-600">
                  {customerInitials}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Profielfoto</h2>
              <p className="text-sm text-slate-500">Upload een recente foto. Je coach ziet deze ook in het trajectoverzicht.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm sm:items-end">
            <label
              htmlFor="profile-photo-upload"
              className={`inline-flex cursor-pointer items-center justify-center rounded-full px-5 py-2 font-semibold text-white shadow-sm transition ${
                photoUploading ? "bg-slate-400" : "bg-brand-600 hover:bg-brand-500"
              }`}
            >
              {photoUploading ? "Uploaden..." : "Nieuwe foto kiezen"}
              <input
                key={photoInputKey}
                id="profile-photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={photoUploading}
                className="hidden"
              />
            </label>
            <p className="text-xs text-slate-400">PNG of JPG, maximaal 5MB</p>
          </div>
        </div>
        {photoStatus ? <div className="mt-4"><StatusBanner state={photoStatus} /></div> : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">EVC-traject details</h2>
            <p className="text-sm text-slate-500">
              Informatie over je trajectcontact en kwalificatiedossier. Pas deze gegevens aan wanneer er wijzigingen zijn.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {evcEditMode ? (
              <button
                type="button"
                onClick={handleEvcCancel}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
              >
                Annuleren
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleEvcPrimaryAction}
              disabled={evcLoading || evcSaving}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
            >
              {evcEditMode ? (evcSaving ? "Opslaan..." : "Opslaan") : "Wijzigen"}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <StatusBanner state={evcStatus} />
          {evcError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {evcError.message || "Kon EVC-trajectgegevens niet laden."}
            </div>
          ) : null}

          {evcLoading ? (
            <LoadingSpinner label="EVC-traject laden" />
          ) : evcEditMode ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="evc-contact-person">
                    Contactpersoon
                  </label>
                  <input
                    id="evc-contact-person"
                    type="text"
                    value={evcDetails.contactPerson || ""}
                    onChange={handleEvcFieldChange("contactPerson")}
                    placeholder="Naam contactpersoon"
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="evc-current-role">
                    Huidige functie
                  </label>
                  <input
                    id="evc-current-role"
                    type="text"
                    value={evcDetails.currentRole || ""}
                    onChange={handleEvcFieldChange("currentRole")}
                    placeholder="Bijvoorbeeld: Teamleider sociaal werk"
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="evc-domains">
                  Domeinen / sectoren
                </label>
                <textarea
                  id="evc-domains"
                  rows={3}
                  value={evcDetails.domains || ""}
                  onChange={handleEvcFieldChange("domains")}
                  placeholder="Bijvoorbeeld: Jeugdzorg, Maatschappelijk werk"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="evc-qualification-name">
                    Naam kwalificatiedossier
                  </label>
                  <input
                    id="evc-qualification-name"
                    type="text"
                    value={evcDetails.qualification?.name || ""}
                    onChange={handleQualificationChange("name")}
                    placeholder="Volledige naam"
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="evc-qualification-number">
                    Kwalificatienummer
                  </label>
                  <input
                    id="evc-qualification-number"
                    type="text"
                    value={evcDetails.qualification?.number || ""}
                    onChange={handleQualificationChange("number")}
                    placeholder="Bijvoorbeeld: 25645"
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="evc-qualification-validity">
                    Geldig tot
                  </label>
                  <input
                    id="evc-qualification-validity"
                    type="text"
                    value={evcDetails.qualification?.validity || ""}
                    onChange={handleQualificationChange("validity")}
                    placeholder="Bijvoorbeeld: 2026"
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={Boolean(evcDetails.voluntaryParticipation)}
                  onChange={handleParticipationChange}
                />
                <span>Ik neem vrijwillig deel aan dit EVC-traject</span>
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Contactpersoon</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{evcSnapshot.contactPerson || "Niet opgegeven"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Huidige functie</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{evcSnapshot.currentRole || "Niet opgegeven"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Domeinen / sectoren</p>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">
                  {evcSnapshot.domains ? evcSnapshot.domains : "Nog geen domeinen geregistreerd."}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Naam kwalificatiedossier</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{evcSnapshot.qualification?.name || "Niet opgegeven"}</p>
                <p className="text-xs text-slate-500">
                  Nummer: {evcSnapshot.qualification?.number || "-"} • Geldig tot: {evcSnapshot.qualification?.validity || "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {evcSnapshot.voluntaryParticipation
                  ? "Je neemt vrijwillig deel aan dit EVC-traject."
                  : "Je hebt nog niet bevestigd dat je vrijwillig deelneemt aan dit EVC-traject."}
              </div>
            </div>
          )}
        </div>
      </section>

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
