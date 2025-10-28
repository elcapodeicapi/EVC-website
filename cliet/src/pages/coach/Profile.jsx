import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Users as UsersIcon, ClipboardList, Mail, Phone, MapPin, CalendarDays, Clock } from "lucide-react";
import { updateCoachProfile } from "../../lib/firestoreCoach";
import { uploadCustomerProfilePhoto } from "../../lib/firestoreCustomer";
import { normalizeTrajectStatus, TRAJECT_STATUS } from "../../lib/trajectStatus";
import ChangePasswordModal from "../../components/ChangePasswordModal";

const CoachProfile = () => {
  const { coach, customers = [], assignments = [], account } = useOutletContext() ?? {};
  const coachUid = coach?.id || coach?.uid || coach?.firebaseUid || account?.firebaseUid || account?.uid || null;

  const [form, setForm] = useState({
    name: "",
    email: "",
    bio: "",
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
    location: "",
  });
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoStatus, setPhotoStatus] = useState(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [photoURL, setPhotoURL] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    if (!coach) return;
    if (editMode) return; // don't clobber draft while editing
    setForm((prev) => ({
      ...prev,
      name: coach?.name || "",
      email: coach?.email || "",
      bio: coach?.bio || "",
      dateOfBirth: coach?.dateOfBirth || "",
      placeOfBirth: coach?.placeOfBirth || "",
      nationality: coach?.nationality || "",
      phoneFixed: coach?.phoneFixed || "",
      phoneMobile: coach?.phoneMobile || coach?.phone || "",
      street: coach?.street || "",
      houseNumber: coach?.houseNumber || "",
      addition: coach?.addition || "",
      postalCode: coach?.postalCode || "",
      city: coach?.city || coach?.location || "",
      location: coach?.location || coach?.city || "",
    }));
    setPhotoURL(coach?.photoURL || "");
  }, [coach, editMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const issues = [];
    if (form.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
      issues.push("Geboortedatum heeft een ongeldig formaat (YYYY-MM-DD).");
    }
    if (form.postalCode && form.postalCode.length < 4) {
      issues.push("Postcode lijkt onvolledig.");
    }
    return issues;
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setPhotoStatus({ type: "error", message: "Kies een geldig afbeeldingsbestand (PNG of JPG)." });
      setPhotoInputKey((v) => v + 1);
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setPhotoStatus({ type: "error", message: "Bestand is groter dan 5MB." });
      setPhotoInputKey((v) => v + 1);
      return;
    }
    if (!coachUid) {
      setPhotoStatus({ type: "error", message: "Kan jouw gebruikers-id niet bepalen." });
      setPhotoInputKey((v) => v + 1);
      return;
    }
    setPhotoUploading(true);
    setPhotoStatus(null);
    try {
      const result = await uploadCustomerProfilePhoto(coachUid, file);
      if (result?.photoURL) setPhotoURL(result.photoURL);
      setPhotoStatus({ type: "success", message: "Profielfoto bijgewerkt" });
    } catch (err) {
      setPhotoStatus({ type: "error", message: err?.message || "Upload mislukt" });
    } finally {
      setPhotoUploading(false);
      setPhotoInputKey((v) => v + 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    const problems = validate();
    if (problems.length > 0) {
      setStatus({ type: "error", message: problems.join(" \u2022 ") });
      return;
    }
    if (!coachUid) {
      setStatus({ type: "error", message: "Kan jouw gebruikers-id niet bepalen." });
      return;
    }
    setSaving(true);
    try {
      await updateCoachProfile(coachUid, {
        name: form.name,
        bio: form.bio,
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
        location: form.location || form.city,
      });
      setStatus({ type: "success", message: "Profiel opgeslagen" });
      setEditMode(false);
    } catch (err) {
      setStatus({ type: "error", message: err?.message || "Opslaan mislukt" });
    } finally {
      setSaving(false);
    }
  };

  const StatusBanner = ({ state }) => {
    if (!state?.message) return null;
    const isError = state.type === "error";
    return (
      <div className={`rounded-2xl border px-4 py-3 text-sm ${isError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
        {state.message}
      </div>
    );
  };
  const assignedCustomers = customers.length;
  const statusSummary = useMemo(
    () =>
      assignments.reduce((acc, item) => {
        const status = normalizeTrajectStatus(item?.status);
        if (!status) return acc;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
    [assignments]
  );
  const collectingCount = statusSummary[TRAJECT_STATUS.COLLECTING] || 0;
  const reviewPipelineCount =
    (statusSummary[TRAJECT_STATUS.REVIEW] || 0) +
    (statusSummary[TRAJECT_STATUS.APPROVAL] || 0);
  const completedAssignments = statusSummary[TRAJECT_STATUS.COMPLETE] || 0;

  const performanceCards = useMemo(
    () => [
      {
        id: "assigned",
  label: "Gekoppelde kandidaten",
        value: String(assignedCustomers),
        icon: UsersIcon,
      },
      {
        id: "collecting",
        label: "Portfolios in voorbereiding",
        value: String(collectingCount),
        icon: ClipboardList,
      },
      {
        id: "review",
        label: "Te beoordelen",
        value: String(reviewPipelineCount),
        icon: Clock,
      },
      {
        id: "completed",
        label: "Beoordeling gereed",
        value: String(completedAssignments),
        icon: CalendarDays,
      },
    ],
    [assignedCustomers, collectingCount, completedAssignments, reviewPipelineCount]
  );

  const expertise = Array.isArray(coach?.expertise) ? coach.expertise : [];
  const availability = Array.isArray(coach?.availability) ? coach.availability : [];
  const upcomingSessions = Array.isArray(coach?.upcomingSessions) ? coach.upcomingSessions : [];

  return (
    <div className="space-y-8">
      {/* Profielfoto upload */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-sm">
              {photoURL ? (
                <img src={photoURL} alt={coach?.name || coach?.email || "Begeleider"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-xl font-semibold text-slate-600">
                  {(coach?.name || coach?.email || "?")
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((p) => p[0]?.toUpperCase())
                    .slice(0, 2)
                    .join("") || "?"}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Profielfoto</h2>
              <p className="text-sm text-slate-500">Upload een recente foto voor je profiel.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm sm:items-end">
            <label
              htmlFor="coach-profile-photo-upload"
              className={`inline-flex cursor-pointer items-center justify-center rounded-full px-5 py-2 font-semibold !text-white shadow-sm transition ${
                photoUploading ? "bg-slate-400" : "bg-brand-600 hover:bg-brand-500"
              }`}
            >
              {photoUploading ? "Uploaden..." : "Nieuwe foto kiezen"}
              <input
                key={photoInputKey}
                id="coach-profile-photo-upload"
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
        {photoStatus ? (
          <div className="mt-4 rounded-2xl border px-4 py-3 text-sm ${photoStatus.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}">
            {photoStatus.message}
          </div>
        ) : null}
      </section>
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-8 py-10 text-white shadow-card">
  <p className="text-sm uppercase tracking-[0.35em] text-white/70">Begeleidersprofiel</p>
        <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-3xl font-semibold text-white">{coach?.name || coach?.email || "Begeleider"}</h2>
            <p className="mt-2 text-white/80">{coach?.role || "EVC Begeleider"}</p>
            <p className="mt-3 max-w-2xl text-sm text-white/70">{coach?.bio || "Je begeleidt professionals in hun EVC-traject en geeft richting met gerichte feedback."}</p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {performanceCards.map((card) => (
              <div
                key={card.id}
                className="flex flex-col items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-center shadow-inner backdrop-blur"
              >
                {card.icon ? <card.icon className="h-5 w-5 text-white/80" /> : null}
                <dt className="mt-2 text-xs uppercase tracking-[0.3em] text-white/70">{card.label}</dt>
                <dd className="mt-2 text-2xl font-semibold">{card.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Editable profile form (personal, contact, address) */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Mijn gegevens</h2>
              <p className="text-sm text-slate-500">Werk je persoonlijke, contact- en adresgegevens bij. Wijzigingen worden pas opgeslagen nadat je op Opslaan klikt.</p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex items-center gap-3">
                {editMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false);
                      setStatus(null);
                      if (coach) {
                        setForm((prev) => ({ ...prev, ...(coach || {}) }));
                      }
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    Annuleren
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    disabled={saving}
                    className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
                  >
                    Wijzigen
                  </button>
                )}
              </div>
              <StatusBanner state={status} />
            </div>
          </div>

          <div className="mt-6 grid gap-8 xl:grid-cols-[1.4fr,1fr]">
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Persoonsgegevens</h3>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <label htmlFor="name" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Naam</label>
                    <input id="name" name="name" value={form.name} onChange={handleChange} disabled={!editMode}
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="dateOfBirth" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Geboortedatum</label>
                    <input id="dateOfBirth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} disabled={!editMode}
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="placeOfBirth" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Geboorteplaats</label>
                    <input id="placeOfBirth" name="placeOfBirth" value={form.placeOfBirth} onChange={handleChange} disabled={!editMode}
                      placeholder="Bijv. Alkmaar"
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="nationality" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Nationaliteit</label>
                    <input id="nationality" name="nationality" value={form.nationality} onChange={handleChange} disabled={!editMode}
                      placeholder="Bijv. NL"
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Contact</h3>
                  <button
                    type="button"
                    onClick={() => setPasswordOpen(true)}
                    className="text-lg font-semibold text-brand-600 transition hover:text-brand-500"
                  >
                    Wachtwoord wijzigen
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label htmlFor="phoneFixed" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Telefoon (vast)</label>
                    <input id="phoneFixed" name="phoneFixed" value={form.phoneFixed} onChange={handleChange} disabled={!editMode}
                      placeholder="0201234567"
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="phoneMobile" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Telefoon (mobiel)</label>
                    <input id="phoneMobile" name="phoneMobile" value={form.phoneMobile} onChange={handleChange} disabled={!editMode}
                      placeholder="0612345678"
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                  <div className="md:col-span-2 grid gap-2">
                    <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">E-mailadres</label>
                    <input id="email" name="email" value={form.email} readOnly
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 shadow-inner" />
                    <p className="text-xs text-slate-400">Het e-mailadres wordt beheerd door je organisatie.</p>
                  </div>
                  <div className="md:col-span-2 grid gap-2">
                    <label htmlFor="bio" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Bio</label>
                    <textarea id="bio" name="bio" rows={3} value={form.bio} onChange={handleChange} disabled={!editMode}
                      placeholder="Korte beschrijving van je rol en expertise"
                      className={`rounded-2xl border px-4 py-3 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 rounded-2xl bg-slate-50 p-6">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Adres</h3>
                <div className="mt-3 grid gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="street" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Straatnaam</label>
                    <input id="street" name="street" value={form.street} onChange={handleChange} disabled={!editMode}
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr,0.8fr]">
                    <div className="grid gap-2">
                      <label htmlFor="houseNumber" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Huisnummer</label>
                      <input id="houseNumber" name="houseNumber" value={form.houseNumber} onChange={handleChange} disabled={!editMode}
                        className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="addition" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Toevoeging</label>
                      <input id="addition" name="addition" value={form.addition} onChange={handleChange} disabled={!editMode}
                        className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="postalCode" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Postcode</label>
                    <input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange} disabled={!editMode}
                      placeholder="Bijv. 1822 BW"
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="city" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Woonplaats</label>
                    <input id="city" name="city" value={form.city} onChange={handleChange} disabled={!editMode}
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="location" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Locatie (weergave)</label>
                    <input id="location" name="location" value={form.location} onChange={handleChange} disabled={!editMode}
                      placeholder="Bijv. Regio Alkmaar"
                      className={`rounded-xl border px-4 py-2.5 text-sm shadow-inner focus:outline-none ${editMode ? "border-slate-200 text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100" : "border-slate-100 bg-slate-50 text-slate-500"}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {editMode ? (
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-lime-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:bg-lime-300"
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        ) : null}
      </form>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <article className="rounded-3xl bg-white p-6 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Contactgegevens</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">E-mail</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                <Mail className="h-4 w-4 text-slate-400" />
                {coach?.email || "Niet bekend"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Telefoon</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                <Phone className="h-4 w-4 text-slate-400" />
                {coach?.phone || "Niet bekend"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Locatie</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                <MapPin className="h-4 w-4 text-slate-400" />
                {coach?.location || "Onbekend"}
              </p>
            </div>
          </div>

          {expertise.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Expertisegebieden</p>
              <ul className="mt-3 flex flex-wrap gap-3">
                {expertise.map((area) => (
                  <li key={area} className="rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Beschikbaarheid</h3>
          {availability.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Geen beschikbaarheid geregistreerd.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {availability.map((slot, index) => (
                <li
                  key={`${slot.day || index}-${slot.slots || index}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 text-sm text-slate-700"
                >
                  <span className="font-medium text-slate-900">{slot.day || "Dag"}</span>
                  <span>{slot.slots || slot.hours || "n.t.b."}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
  <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h3 className="text-base font-semibold text-slate-900">Aankomende sessies</h3>
        {upcomingSessions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Er zijn nog geen sessies gepland.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {upcomingSessions.map((session) => (
              <article
                key={session.id || `${session.customer}-${session.date}`}
                className="rounded-2xl border border-slate-100 p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-slate-900">{session.customer || "Kandidaat"}</p>
                <p className="text-xs text-slate-500">{session.date || "Datum onbekend"}</p>
                <p className="mt-3 text-sm text-slate-600">{session.focus || session.topic || "Geen onderwerp"}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CoachProfile;
