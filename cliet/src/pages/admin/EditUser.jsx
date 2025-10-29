import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Save, ArrowLeft, UserCircle2, Image as ImageIcon, Trash2 } from "lucide-react";
import { fetchAdminProfile, updateAdminProfile, updateCustomerResumeCore, fetchUserDoc } from "../../lib/firestoreAdmin";
import { subscribeCustomerResume, uploadCustomerProfilePhoto } from "../../lib/firestoreCustomer";

function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export default function AdminEditUser() {
  const navigate = useNavigate();
  const { id: userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [resume, setResume] = useState({});

  // Local editable state
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneMobile: "",
    phoneFixed: "",
    dateOfBirth: "",
    placeOfBirth: "",
    nationality: "",
    street: "",
    houseNumber: "",
    addition: "",
    postalCode: "",
    city: "",
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const base = await fetchAdminProfile(userId);
        const userDoc = await fetchUserDoc(userId);
        if (!mounted) return;
        setProfile(base || userDoc || null);
        const initial = {
          name: base?.name || userDoc?.name || "",
          email: base?.email || userDoc?.email || "",
          phoneMobile: base?.phoneMobile || base?.phone || userDoc?.phone || "",
          phoneFixed: base?.phoneFixed || "",
          dateOfBirth: base?.dateOfBirth || "",
          placeOfBirth: base?.placeOfBirth || "",
          nationality: base?.nationality || "",
          street: base?.street || "",
          houseNumber: base?.houseNumber || "",
          addition: base?.addition || "",
          postalCode: base?.postalCode || "",
          city: base?.city || base?.location || "",
        };
        setForm(initial);
      } catch (e) {
        if (mounted) setError(e?.message || "Kon gebruiker niet laden");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  // Listen to resume for photoURL mirroring
  useEffect(() => {
    if (!userId) return () => {};
    const unsubscribe = subscribeCustomerResume(userId, ({ data }) => {
      setResume(data || {});
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [userId]);

  const photoURL = profile?.photoURL || resume?.photoURL || "";

  const handleChange = (key) => (e) => {
    const value = e?.target?.value ?? e;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const issues = [];
    if (!form.name.trim()) issues.push("Naam is verplicht");
    if (!form.email.trim()) issues.push("E-mail is verplicht");
    if (form.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
      issues.push("Geboortedatum moet YYYY-MM-DD zijn");
    }
    return issues;
  };

  const [status, setStatus] = useState(null);

  const handleSave = async () => {
    const issues = validate();
    if (issues.length) {
      setError(issues.join("\n"));
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      // Update admin profile overlay and base user fields (name/phone) via updateAdminProfile
      await updateAdminProfile(userId, form);
      // Also write core resume fields to profiles/{uid} so candidate profile shows it
      await updateCustomerResumeCore(userId, form);
      setStatus({ type: "success", message: "Gegevens opgeslagen" });
    } catch (e) {
      setError(e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => navigate(-1);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      await uploadCustomerProfilePhoto(userId, file);
    } catch (e2) {
      setError(e2?.message || "Uploaden mislukt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Admin · Gebruiker bewerken</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{profile?.name || profile?.email || "Gebruiker"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300">
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:opacity-60">
            {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Opslaan…</>) : (<><Save className="h-4 w-4" /> Opslaan</>)}
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-line">{error}</div>
      ) : null}
      {status?.type === "success" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status.message}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-500">
          <div className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Laden…</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Naam" required>
                <input type="text" value={form.name} onChange={handleChange("name")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="E-mail" required>
                <input type="email" value={form.email} onChange={handleChange("email")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Mobiel">
                <input type="tel" value={form.phoneMobile} onChange={handleChange("phoneMobile")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Vaste lijn">
                <input type="tel" value={form.phoneFixed} onChange={handleChange("phoneFixed")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Geboortedatum">
                <input type="date" value={form.dateOfBirth} onChange={handleChange("dateOfBirth")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Geboorteplaats">
                <input type="text" value={form.placeOfBirth} onChange={handleChange("placeOfBirth")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Nationaliteit">
                <input type="text" value={form.nationality} onChange={handleChange("nationality")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Straat">
                <input type="text" value={form.street} onChange={handleChange("street")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Huisnummer">
                <input type="text" value={form.houseNumber} onChange={handleChange("houseNumber")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Toevoeging">
                <input type="text" value={form.addition} onChange={handleChange("addition")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Postcode">
                <input type="text" value={form.postalCode} onChange={handleChange("postalCode")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
              <Field label="Woonplaats">
                <input type="text" value={form.city} onChange={handleChange("city")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              </Field>
            </div>
          </section>
          <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {photoURL ? (
                  <img src={photoURL} alt="Profielfoto" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <UserCircle2 className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                  <ImageIcon className="h-4 w-4" />
                  <span>Nieuwe foto</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
