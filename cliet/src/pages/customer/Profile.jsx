import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { get, put } from "../../lib/api";
import { subscribeCustomerProfileDetails, subscribeCustomerResume, updateCustomerProfileDetails, uploadCustomerProfilePhoto, uploadCustomerCertificateFile, uploadCustomerOtherDocument, migrateLegacyEducationProfile, addEducationItem, addEducationItemAttachments, deleteEducationItem } from "../../lib/firestoreCustomer";
import LoadingSpinner from "../../components/LoadingSpinner";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import ChangePasswordModal from "../../components/ChangePasswordModal";

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
  educationItems: [],
  workExperience: [],
  overigeDocumenten: [],
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
  const [eduItemDraft, setEduItemDraft] = useState({ title: "", year: "", diplomaObtained: false, type: "Anders", note: "", files: [] });
  const [eduItemSaving, setEduItemSaving] = useState(false);
  const [eduItemStatus, setEduItemStatus] = useState(null);
  const [eduItemDeletingId, setEduItemDeletingId] = useState(null);
  const [otherDraft, setOtherDraft] = useState({ omschrijving: "", datum: "", toelichting: "", file: null });
  const [otherUploading, setOtherUploading] = useState(false);
  const [otherStatus, setOtherStatus] = useState(null);
  const [otherInputKey, setOtherInputKey] = useState(0);
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
  const [passwordOpen, setPasswordOpen] = useState(false);

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

  // Keep overigeDocumenten (and optionally other resume fields in future) in sync with Firestore like Mijn Portfolio
  useEffect(() => {
    if (!customerId) return () => {};
    // Trigger migration to unified education items if needed (no-op if already migrated)
    migrateLegacyEducationProfile(customerId).catch(() => {});
    const unsubscribe = subscribeCustomerResume(customerId, ({ data }) => {
      const safe = data || {};
      const overige = Array.isArray(safe.overigeDocumenten) ? safe.overigeDocumenten : [];
      const educationItems = Array.isArray(safe.educationItems) ? safe.educationItems : [];
      setForm((prev) => {
        // Only update overigeDocumenten if changed to avoid unnecessary rerenders
        const prevList = Array.isArray(prev.overigeDocumenten) ? prev.overigeDocumenten : [];
        const sameLength = prevList.length === overige.length;
        const sameIds = sameLength && prevList.every((it, idx) => (it?.id || it?.fileUrl) === (overige[idx]?.id || overige[idx]?.fileUrl));
        const base = sameIds ? prev : { ...prev, overigeDocumenten: overige };
        // Always mirror educationItems, including empty arrays
        return { ...base, educationItems };
      });
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customerId]);

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
        overigeDocumenten: (form.overigeDocumenten || []).map(({ id, omschrijving, datum, toelichting, fileUrl, createdAt }) => ({
          id,
          omschrijving,
          datum,
          toelichting,
          fileUrl,
          createdAt,
        })),
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

  const StatusBanner = ({ state, className = "" }) => {
    if (!state?.message) return null;
    const isError = state.type === "error";
    const Icon = isError ? TriangleAlert : CheckCircle2;
    const color = isError
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

    return (
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${color} ${className}`.trim()}>
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
    if (!customerId) {
      setPhotoStatus({ type: "error", message: "Kon je accountgegevens niet vinden." });
      setPhotoInputKey((value) => value + 1);
      return;
    }
    setPhotoUploading(true);
    setPhotoStatus(null);
    try {
      const response = await uploadCustomerProfilePhoto(customerId, file);
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

  const handleEduFilesChange = (event) => {
    const list = event.target.files;
    const selected = list && typeof list.length === "number" ? Array.from(list) : [];
    setEduItemDraft((prev) => ({ ...prev, files: selected }));
  };

  const handleAddEducationItem = async () => {
    if (!customerId) return;
    const title = (eduItemDraft.title || "").trim();
    const year = (eduItemDraft.year || "").toString().trim();
    if (!title) {
      setEduItemStatus({ type: "error", message: "Vul de titel in." });
      return;
    }
    if (!year) {
      setEduItemStatus({ type: "error", message: "Vul het jaar in." });
      return;
    }
    setEduItemSaving(true);
    setEduItemStatus(null);
    try {
      const created = await addEducationItem(customerId, {
        title,
        year,
        diplomaObtained: Boolean(eduItemDraft.diplomaObtained),
        type: eduItemDraft.type,
        note: eduItemDraft.note || "",
      });
      if (Array.isArray(eduItemDraft.files) && eduItemDraft.files.length > 0) {
        await addEducationItemAttachments(customerId, created.id, eduItemDraft.files);
      }
      // Do not mutate local list; subscribeCustomerResume will refresh with the authoritative array
      setEduItemDraft({ title: "", year: "", diplomaObtained: false, type: "Anders", note: "", files: [] });
      setEduItemStatus({ type: "success", message: "Item toegevoegd" });
    } catch (err) {
      setEduItemStatus({ type: "error", message: err?.message || "Toevoegen mislukt" });
    } finally {
      setEduItemSaving(false);
    }
  };

  const handleDeleteEducationItem = async (itemId) => {
    if (!customerId || !itemId) return;
    if (!window.confirm("Weet je zeker dat je deze opleiding/cursus wilt verwijderen?")) return;
    setEduItemStatus(null);
    setEduItemDeletingId(itemId);
    try {
      await deleteEducationItem(customerId, itemId);
      // Rely on subscription to refresh the list
      setEduItemStatus({ type: "success", message: "Verwijderd" });
    } catch (err) {
      setEduItemStatus({ type: "error", message: err?.message || "Verwijderen mislukt" });
    } finally {
      setEduItemDeletingId(null);
    }
  };

  const addCertificate = async () => {
    if (!certificateDraft.file) {
      setCertificateStatus({ type: "error", message: "Kies eerst een bestand." });
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB (aligned with backend limit previously)
    if (certificateDraft.file.size > maxSize) {
      setCertificateStatus({ type: "error", message: "Bestand is groter dan 5MB." });
      return;
    }

    const title = certificateDraft.title.trim() || certificateDraft.file.name;
    setCertificateUploading(true);
    setCertificateStatus(null);
    try {
      if (!customerId) throw new Error("Kon je accountgegevens niet vinden.");
      const upload = await uploadCustomerCertificateFile(customerId, certificateDraft.file, title);

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

  const handleOtherFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setOtherDraft((prev) => ({ ...prev, file }));
  };

  const addOtherDocument = async () => {
    const title = (otherDraft.omschrijving || "").trim();
    if (!title) {
      setOtherStatus({ type: "error", message: "Omschrijving/Titel is verplicht." });
      return;
    }
    if (!otherDraft.file) {
      setOtherStatus({ type: "error", message: "Kies eerst een bestand." });
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (otherDraft.file.size > maxSize) {
      setOtherStatus({ type: "error", message: "Bestand is groter dan 10MB." });
      return;
    }
    if (!customerId) {
      setOtherStatus({ type: "error", message: "Kon je accountgegevens niet vinden." });
      return;
    }

    setOtherUploading(true);
    setOtherStatus(null);
    try {
      const payload = await uploadCustomerOtherDocument({
        userId: customerId,
        file: otherDraft.file,
        omschrijving: title,
        datum: otherDraft.datum || "",
        toelichting: otherDraft.toelichting || "",
      });
      setForm((prev) => ({
        ...prev,
        overigeDocumenten: [...(prev.overigeDocumenten || []), payload],
      }));
      setOtherDraft({ omschrijving: "", datum: "", toelichting: "", file: null });
      setOtherInputKey((v) => v + 1);
      setOtherStatus({ type: "success", message: "Document toegevoegd" });
    } catch (error) {
      setOtherStatus({ type: "error", message: error?.data?.error || error?.message || "Upload mislukt" });
    } finally {
      setOtherUploading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Profiel laden" />;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
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
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />

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
              <p className="text-sm text-slate-500">Upload een recente foto. Je begeleider ziet deze ook in het trajectoverzicht.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm sm:items-end">
            <label
              htmlFor="profile-photo-upload"
              className={`inline-flex cursor-pointer items-center justify-center rounded-full px-5 py-2 font-semibold !text-white shadow-sm transition ${
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">EVC-traject details</h2>
            <p className="text-sm text-slate-500">
              Informatie over je trajectcontact en kwalificatiedossier. Pas deze gegevens aan wanneer er wijzigingen zijn.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
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
            <StatusBanner state={evcStatus} className="w-full sm:w-auto" />
          </div>
        </div>

        <div className="mt-4 space-y-4">
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
                <span className="!font-bold !text-black">
                  Ik neem vrijwillig deel aan dit EVC-traject
                  </span>
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
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-black">
                {evcSnapshot.voluntaryParticipation
                  ? "Je neemt vrijwillig deel aan dit EVC-traject."
                  : "Je hebt nog niet bevestigd dat je vrijwillig deelneemt aan dit EVC-traject."}
              </div>
            </div>
          )}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                    onClick={() => setPasswordOpen(true)}
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
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Opleiding of cursus</h2>
              <p className="mt-2 text-sm text-slate-500">Beheer hier je opleidingen, cursussen en trainingen. Voeg toelichting en bijlagen toe.</p>
            </div>
            <div className="space-y-4">
              {(form.educationItems || []).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Nog geen opleiding of cursus toegevoegd.
                </p>
              ) : (
                <ul className="space-y-3">
                  {form.educationItems.map((it) => (
                    <li key={it.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{it.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{it.year ? `Afgesloten in ${it.year}` : "Jaar onbekend"} • {it.diplomaObtained ? "Diploma/certificaat behaald" : "Geen diploma/certificaat"} • {it.type || "Anders"}</p>
                          {it.note ? <p className="mt-2 text-sm text-slate-600">{it.note}</p> : null}
                        </div>
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeleteEducationItem(it.id)}
                            disabled={eduItemDeletingId === it.id}
                            className="text-xs font-semibold text-red-600 transition hover:text-red-500 disabled:opacity-60"
                          >
                            {eduItemDeletingId === it.id ? "Verwijderen…" : "Verwijderen"}
                          </button>
                        </div>
                      </div>
                      {Array.isArray(it.attachments) && it.attachments.length > 0 ? (
                        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {it.attachments.map((att) => (
                            <li key={att.id || att.storagePath}>
                              <a href={att.downloadURL} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 shadow-sm hover:text-brand-600">
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Nieuw item toevoegen</h3>
              <div className="mt-3 grid gap-3 text-sm">
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    type="text"
                    value={eduItemDraft.title}
                    onChange={(e) => setEduItemDraft((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Opleiding of cursus"
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="\\d*"
                    value={eduItemDraft.year}
                    onChange={(e) => setEduItemDraft((prev) => ({ ...prev, year: e.target.value }))}
                    placeholder="Afgesloten in (jaar)"
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={eduItemDraft.diplomaObtained ? "yes" : "no"}
                    onChange={(e) => setEduItemDraft((prev) => ({ ...prev, diplomaObtained: e.target.value === "yes" }))}
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="yes">Diploma/certificaat behaald</option>
                    <option value="no">Geen diploma/certificaat</option>
                  </select>
                  <select
                    value={eduItemDraft.type}
                    onChange={(e) => setEduItemDraft((prev) => ({ ...prev, type: e.target.value }))}
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    {[
                      "Algemeen onderwijs",
                      "Beroepsonderwijs",
                      "Hoger onderwijs",
                      "Cursus",
                      "Training",
                      "Anders",
                    ].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={eduItemDraft.note}
                  onChange={(e) => setEduItemDraft((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Toelichting / onderbouwing"
                  rows={3}
                  className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-600">
                    <span aria-hidden>📎</span>
                    <span>Bijlage(n) toevoegen</span>
                    <input type="file" multiple className="hidden" onChange={handleEduFilesChange} />
                  </label>
                  {Array.isArray(eduItemDraft.files) && eduItemDraft.files.length > 0 ? (
                    <span className="text-sm text-slate-500">Geselecteerd: {eduItemDraft.files.length === 1 ? eduItemDraft.files[0].name : `${eduItemDraft.files.length} bestanden`}</span>
                  ) : null}
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={handleAddEducationItem}
                    disabled={eduItemSaving}
                    className="inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
                  >
                    {eduItemSaving ? "Opslaan..." : "Toevoegen"}
                  </button>
                </div>
                    {eduItemStatus ? (
                    <p
                      className={`mt-2 flex items-center gap-2 text-sm font-semibold ${
                        eduItemStatus.type === "error"
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {eduItemStatus.type === "error" ? (
                        <span aria-hidden="true" className="text-lg font-bold">❌</span>
                      ) : (
                        <span aria-hidden="true" className="text-lg font-bold">✅</span>
                      )}
                      {eduItemStatus.message}
                    </p>
                  ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Overige informatie en documenten */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Overige informatie en documenten</h2>
                <p className="mt-2 text-sm text-slate-500">Voeg overige bewijsstukken toe die niet onder de andere categorieën vallen.</p>
              </div>
              <div className="space-y-4">
                {(form.overigeDocumenten || []).length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Nog geen overige informatie toegevoegd.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {form.overigeDocumenten.map((doc) => (
                      <li key={doc.id || doc.fileUrl} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{doc.omschrijving}</p>
                            {doc.datum ? (
                              <p className="text-xs uppercase tracking-wide text-slate-400">Datum: {doc.datum}</p>
                            ) : null}
                          </div>
                          {doc.fileUrl ? (
                            <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-600 transition hover:text-brand-500">
                              Download
                            </a>
                          ) : null}
                        </div>
                        {doc.toelichting ? <p className="mt-2 text-sm text-slate-500">{doc.toelichting}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Nieuw item toevoegen</h3>
              <div className="grid gap-3 text-sm">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Omschrijving/Titel <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={otherDraft.omschrijving}
                    onChange={(e) => setOtherDraft((prev) => ({ ...prev, omschrijving: e.target.value }))}
                    placeholder="Titel of omschrijving"
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Datum bewijsstuk</label>
                  <input
                    type="date"
                    value={otherDraft.datum}
                    onChange={(e) => setOtherDraft((prev) => ({ ...prev, datum: e.target.value }))}
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Toelichting en reden van toevoegen</label>
                  <textarea
                    rows={3}
                    value={otherDraft.toelichting}
                    onChange={(e) => setOtherDraft((prev) => ({ ...prev, toelichting: e.target.value }))}
                    placeholder="Korte toelichting"
                    className="rounded-xl border border-slate-200 px-4 py-2 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Bestand uploaden</label>
                  <input key={otherInputKey} type="file" onChange={handleOtherFileChange} className="text-sm" />
                </div>
                <button
                  type="button"
                  onClick={addOtherDocument}
                  disabled={otherUploading}
                  className="inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
                >
                  {otherUploading ? "Bezig met uploaden..." : "Upload en voeg toe"}
                </button>
                {otherStatus ? (
                  <p className={`text-xs ${otherStatus.type === "error" ? "text-red-500" : "text-emerald-600"}`}>
                    {otherStatus.message}
                  </p>
                ) : null}
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

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-lime-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:bg-lime-300"
          >
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
          <StatusBanner state={status} className="w-full sm:w-auto" />
        </div>
      </form>
    </div>
  );
};

export default CustomerProfile;
