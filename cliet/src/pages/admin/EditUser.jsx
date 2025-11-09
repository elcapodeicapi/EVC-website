import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Save, ArrowLeft, UserCircle2, Image as ImageIcon } from "lucide-react";
import ModalForm from "../../components/ModalForm";
import { fetchAdminProfile, updateAdminProfile, updateCustomerResumeCore, fetchUserDoc, fetchUsersByRole, updateUserEmail } from "../../lib/firestoreAdmin";
import { subscribeCustomerResume, uploadCustomerProfilePhoto } from "../../lib/firestoreCustomer";
import { subscribeAssignmentByCustomerId } from "../../lib/firestoreCoach";
import { TRAJECT_STATUS, normalizeTrajectStatus } from "../../lib/trajectStatus";
import { updateAssignmentStatus } from "../../lib/assignmentWorkflow";

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
  const { isAdmin } = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return { isAdmin: false };
      const u = JSON.parse(raw);
      const role = (u?.role || "").toString().toLowerCase();
      const admin = role === "admin" || Boolean(u?.isAdmin) || Boolean(u?.admin === true);
      return { isAdmin: admin };
    } catch (_) {
      return { isAdmin: false };
    }
  }, []);

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

  // Assignment-related state (status and assessor)
  const [assignment, setAssignment] = useState(null);
  const [statusValue, setStatusValue] = useState(TRAJECT_STATUS.COLLECTING);
  const [initialStatus, setInitialStatus] = useState(TRAJECT_STATUS.COLLECTING);
  const [assessorId, setAssessorId] = useState("");
  const [initialAssessorId, setInitialAssessorId] = useState("");
  const [assessors, setAssessors] = useState([]);
  const [assessorsLoading, setAssessorsLoading] = useState(false);
  const [assessorsError, setAssessorsError] = useState(null);
  // No coach linking on this page; handled in TrajectEdit
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  // Subscribe to the candidate's assignment to reflect current status and assessor
  useEffect(() => {
    if (!userId) return () => {};
    const unsubscribe = subscribeAssignmentByCustomerId(userId, ({ data }) => {
      if (data) {
        setAssignment(data);
        const s = normalizeTrajectStatus(data.status) || TRAJECT_STATUS.COLLECTING;
        setStatusValue(s);
        setInitialStatus(s);
        const aId = data.assessorId || "";
        setAssessorId(aId || "");
        setInitialAssessorId(aId || "");
  // coach linkage managed in EVC-traject wijzigen page
      } else {
        setAssignment(null);
        setStatusValue(TRAJECT_STATUS.COLLECTING);
        setInitialStatus(TRAJECT_STATUS.COLLECTING);
        setAssessorId("");
        setInitialAssessorId("");
  // coach linkage managed in EVC-traject wijzigen page
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [userId]);

  const maybeLoadAssessors = async () => {
    if (!isAdmin) return;
    if (assessorsLoading) return;
    setAssessorsLoading(true);
    setAssessorsError(null);
    try {
      const list = await fetchUsersByRole("assessor");
      setAssessors(Array.isArray(list) ? list : []);
    } catch (e) {
      setAssessorsError(e?.message || "Kon assessoren niet laden");
    } finally {
      setAssessorsLoading(false);
    }
  };

  // no coach picker here

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
    // If admin is changing status/assessor, confirm before applying
    const statusChanged = isAdmin && (statusValue !== initialStatus || (assessorId || "") !== (initialAssessorId || ""));
    if (statusChanged) {
      setConfirmOpen(true);
      return;
    }
    await performSave(false);
  };

  const performSave = async (applyStatusChange = false) => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      // If email changed, update via backend to keep Auth and Firestore in sync
      const initialEmail = (profile?.email || "").trim().toLowerCase();
      const nextEmail = (form.email || "").trim().toLowerCase();
      if (nextEmail && initialEmail && nextEmail !== initialEmail) {
        await updateUserEmail(userId, form.email.trim());
      }
      // Profile + resume core fields
      await updateAdminProfile(userId, form);
      await updateCustomerResumeCore(userId, form);
      // Coach linking is handled in TrajectEdit
      // Optional status update
      if (applyStatusChange && isAdmin) {
        await updateAssignmentStatus({ customerId: userId, status: statusValue, assessorId: assessorId || undefined });
        setInitialStatus(statusValue);
        setInitialAssessorId(assessorId || "");
        setStatus({ type: "success", message: "Status en assessor succesvol bijgewerkt." });
      } else {
        setStatus({ type: "success", message: "Gegevens opgeslagen" });
      }
    } catch (e) {
      setError(e?.data?.error || e?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
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

            {isAdmin ? (
              <div className="mt-4 space-y-3">
                {/* Begeleider selectie is verplaatst naar EVC-traject wijzigen */}
                <Field label="Trajectstatus">
                  <select
                    value={statusValue}
                    onChange={(e) => setStatusValue(normalizeTrajectStatus(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value={TRAJECT_STATUS.COLLECTING}>Bewijzen verzamelen</option>
                    <option value={TRAJECT_STATUS.REVIEW}>Ter beoordeling</option>
                    <option value={TRAJECT_STATUS.QUALITY}>Ter goedkeuring</option>
                    <option value={TRAJECT_STATUS.COMPLETE}>Afgerond</option>
                    {/* Admin-only terminal status, now part of the status set */}
                    <option value={TRAJECT_STATUS.ARCHIVED}>In archief</option>
                  </select>
                </Field>

                {(statusValue === TRAJECT_STATUS.REVIEW || statusValue === TRAJECT_STATUS.QUALITY) ? (
                  <Field label="Kies assessor">
                    <select
                      value={assessorId}
                      onChange={(e) => setAssessorId(e.target.value)}
                      onFocus={maybeLoadAssessors}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="">{assessorsLoading ? "Laden..." : "Kies een assessor"}</option>
                      {assessors.map((a) => (
                        <option key={a.id} value={a.id}>{a.name || a.email || a.id}</option>
                      ))}
                    </select>
                    {assessorsError ? (
                      <div className="mt-1 text-xs text-red-600">{assessorsError}</div>
                    ) : null}
                  </Field>
                ) : null}

                {assignment?.assessorId ? (
                  <div className="text-xs text-slate-500">Huidig toegewezen aan: {assignment.assessorName || assignment.assessorEmail || assignment.assessorId}</div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      )}

      {confirmOpen ? (
        <ModalForm
          open={true}
          title="Status wijzigen"
          description="Weet je zeker dat je de status wilt wijzigen?"
          onClose={() => (!saving ? setConfirmOpen(false) : null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => performSave(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:opacity-60"
              >
                {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Opslaan…</>) : "Bevestigen"}
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
