import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import { subscribeAdminProfile, updateAdminProfile } from "../../lib/firestoreAdmin";
import { uploadCustomerProfilePhoto } from "../../lib/firestoreCustomer";
import LoadingSpinner from "../../components/LoadingSpinner";
import ChangePasswordModal from "../../components/ChangePasswordModal";

const ROLE_LABELS = new Map([
  ["admin", "Beheerder"],
  ["coach", "Begeleider"],
  ["kwaliteitscoordinator", "Kwaliteitscoördinator"],
  ["assessor", "Assessor"],
  ["customer", "Kandidaat"],
  ["user", "Kandidaat"],
]);

const resolveRoleLabel = (role) => {
  if (!role) return "Beheerder";
  const normalized = role.toString().trim().toLowerCase();
  if (!normalized) return "Beheerder";
  return ROLE_LABELS.get(normalized) || role;
};

const initialFormState = {
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
};

const AdminProfile = () => {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoStatus, setPhotoStatus] = useState(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [photoURL, setPhotoURL] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const resolvedUid = parsed?.firebaseUid || parsed?.uid;
        if (resolvedUid && mounted) {
          setUid(resolvedUid);
        }
      } catch (e) {
        // ignore malformed storage
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (current) => {
      if (mounted) {
        setUid((prev) => prev || current?.uid || null);
      }
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = subscribeAdminProfile(uid, ({ data, error: snapshotError }) => {
      if (snapshotError) {
        setError(snapshotError);
        setLoading(false);
        return;
      }
      setProfile(data);
      if (!editMode) {
        setForm((prev) => ({
          ...prev,
          name: data?.name || "",
          email: data?.email || "",
          bio: data?.bio || "",
          dateOfBirth: data?.dateOfBirth || "",
          placeOfBirth: data?.placeOfBirth || "",
          nationality: data?.nationality || "",
          phoneFixed: data?.phoneFixed || "",
          phoneMobile: data?.phoneMobile || data?.phone || "",
          street: data?.street || "",
          houseNumber: data?.houseNumber || "",
          addition: data?.addition || "",
          postalCode: data?.postalCode || "",
          city: data?.city || data?.location || "",
          location: data?.location || data?.city || "",
        }));
      }
      setPhotoURL(data?.photoURL || "");
      setError(null);
      setLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [uid, editMode]);

  const highlights = Array.isArray(profile?.highlights) ? profile.highlights : [];
  const responsibilities = Array.isArray(profile?.responsibilities) ? profile.responsibilities : [];

  const displayRole = resolveRoleLabel(profile?.role);

  const displayName = profile?.name || profile?.email || "Beheerder";

  const displayInitials = useMemo(() => {
    const source = form.name || profile?.name || profile?.email || "";
    if (!source) return "?";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "?";
  }, [form.name, profile?.email, profile?.name]);

  if (loading) {
    return <LoadingSpinner label="Profiel laden" />;
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-700 shadow-sm">
        Kon profiel niet laden: {error.message || "Onbekende fout"}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm">
        Geen profielgegevens gevonden. Zorg dat je account is gekoppeld aan Firebase.
      </div>
    );
  }

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
    if (!uid) {
      setPhotoStatus({ type: "error", message: "Kan jouw gebruikers-id niet bepalen." });
      setPhotoInputKey((v) => v + 1);
      return;
    }
    setPhotoUploading(true);
    setPhotoStatus(null);
    try {
      const result = await uploadCustomerProfilePhoto(uid, file);
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
    setSaving(true);
    try {
      const payload = {
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
      };
      await updateAdminProfile(uid, payload);
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
      <div
        className={`rounded-2xl border px-4 py-3 text-sm ${
          isError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        {state.message}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Profielfoto upload */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-sm">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-xl font-semibold text-slate-600">
                  {displayInitials}
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
              htmlFor="admin-profile-photo-upload"
              className={`inline-flex cursor-pointer items-center justify-center rounded-full px-5 py-2 font-semibold text-white shadow-sm transition ${
                photoUploading ? "bg-slate-400" : "bg-brand-600 hover:bg-brand-500"
              }`}
            >
              {photoUploading ? "Uploaden..." : "Nieuwe foto kiezen"}
              <input
                key={photoInputKey}
                id="admin-profile-photo-upload"
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
          <div className="mt-4"><StatusBanner state={photoStatus} /></div>
        ) : null}
      </section>
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-8 py-10 text-white shadow-card">
        <p className="text-sm uppercase tracking-[0.35em] text-white/60">Profiel</p>
        <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full border border-white/20 bg-white/10">
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white/90">
                {displayInitials}
              </div>
            </div>
            <div>
              <h2 className="text-3xl !text-white font-semibold">{displayName}</h2>
              <p className="mt-2 text-white/80">{displayRole}</p>
              <p className="mt-3 max-w-2xl text-sm text-white/70">{profile?.bio || "Nog geen biografie toegevoegd."}</p>
            </div>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.length === 0 ? (
              <div className="col-span-full text-sm text-white/70">Nog geen statistieken vastgelegd.</div>
            ) : null}
            {highlights.map((highlight) => (
              <div key={highlight.id} className="rounded-2xl bg-white/10 px-4 py-3 text-center shadow-inner backdrop-blur">
                <dt className="text-xs uppercase tracking-[0.3em] text-white/70">{highlight.label}</dt>
                <dd className="mt-2 text-2xl font-semibold">{highlight.metric}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Persoons- en contactgegevens</h2>
              <p className="text-sm text-slate-500">Werk je gegevens bij. Wijzigingen worden pas opgeslagen nadat je op Opslaan klikt.</p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex items-center gap-3">
                {editMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false);
                      setStatus(null);
                      // revert to snapshot
                      setForm((prev) => ({ ...prev, ...(profile || {}) }));
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
                    className="text-sm font-semibold text-brand-600 transition hover:text-brand-500"
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

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
          {editMode ? (
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-lime-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:bg-lime-300"
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
          ) : null}
        </div>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Verantwoordelijkheden</h3>
        {responsibilities.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nog geen verantwoordelijkheden toegevoegd.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {responsibilities.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
  <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
};

export default AdminProfile;
