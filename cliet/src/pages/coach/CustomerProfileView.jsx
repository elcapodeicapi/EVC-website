import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, FileText, GraduationCap, IdCard, MapPin, Phone, UserRound } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import { subscribeCoachCustomerProfile } from "../../lib/firestoreCoach";

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
    <p className="mt-1 text-sm text-slate-700">{value || "—"}</p>
  </div>
);

const List = ({ title, items, renderItem }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center gap-2">
      <FileText className="h-4 w-4 text-slate-400" />
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
    {Array.isArray(items) && items.length > 0 ? (
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li key={item.id || item.title || item.name || idx} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {renderItem(item)}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-slate-500">Geen gegevens</p>
    )}
  </section>
);

const CustomerProfileView = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { basePath = "/coach" } = useOutletContext() ?? {};

  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    if (!customerId) {
      setState({ loading: false, error: new Error("Geen kandidaat-id"), data: null });
      return () => {};
    }
    setState((prev) => ({ ...prev, loading: true }));
    const unsubscribe = subscribeCoachCustomerProfile(customerId, ({ data, error }) => {
      if (error) {
        setState({ loading: false, error, data: null });
        return;
      }
      setState({ loading: false, error: null, data: data || null });
    });
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, [customerId]);

  const profile = state.data?.profile || {};
  const resume = state.data?.resume || {};
  const evc = state.data?.evcTrajectory || profile?.evcTrajectory || {};
  const customer = state.data?.customer || {};

  const addressLine1 = [resume.street, resume.houseNumber, resume.addition].filter(Boolean).join(" ");
  const addressLine2 = [resume.postalCode, resume.city].filter(Boolean).join(" ");

  const educationUnified = Array.isArray(resume.educationItems) && resume.educationItems.length > 0
    ? resume.educationItems
    : (Array.isArray(resume.educations) ? resume.educations : []);

  const certificatesList = Array.isArray(resume.certificates) ? resume.certificates : [];
  const workExperienceList = Array.isArray(profile.workExperience) && profile.workExperience.length > 0
    ? profile.workExperience : (Array.isArray(resume.workExperience) ? resume.workExperience : []);
  const otherDocs = Array.isArray(resume.overigeDocumenten) ? resume.overigeDocumenten : [];

  const goBack = () => {
    const normalizedBase = basePath.startsWith("/") ? basePath.replace(/\/$/, "") : `/${basePath.replace(/\/$/, "")}`;
    navigate(`${normalizedBase}/customers/${customerId}`);
  };

  if (state.loading) return <LoadingSpinner label="Profiel laden" />;
  if (state.error) return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      Kon profiel niet laden: {state.error.message || "Onbekende fout"}
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Kandidaat • Profiel</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{customer.name || customer.email || "Kandidaat"}</h1>
        </div>
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar traject
        </button>
      </header>

      {/* EVC-trajectdetails */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <IdCard className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">EVC-trajectdetails</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Contactpersoon" value={evc.contactPerson} />
          <Field label="Domein(en)" value={evc.domains} />
          <Field label="Huidige functie" value={evc.currentRole} />
          <Field label="Kwalificatiedossier" value={evc?.qualification?.name} />
          <Field label="Niveau" value={evc?.qualification?.number} />
          <Field label="Geldig tot" value={evc?.qualification?.validity} />
          <Field label="Vrijwillige deelname" value={evc.voluntaryParticipation ? "Ja" : "Nee"} />
        </div>
      </section>

      {/* Persoonsgegevens */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <UserRound className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Persoonsgegevens</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Naam" value={customer.name} />
          <Field label="E-mail" value={customer.email} />
          <Field label="Geboortedatum" value={resume.dateOfBirth} />
          <Field label="Geboorteplaats" value={resume.placeOfBirth} />
          <Field label="Nationaliteit" value={resume.nationality} />
          <Field label="Telefoon (mobiel)" value={resume.phoneMobile} />
          <Field label="Telefoon (vast)" value={resume.phoneFixed} />
          <Field label="Adres" value={addressLine1} />
          <Field label="Postcode en plaats" value={addressLine2} />
        </div>
      </section>

      {/* Opleidingen, diploma's en certificaten */}
      <List
        title="Opleidingen / cursussen / diploma’s / certificaten"
        items={educationUnified}
        renderItem={(it) => (
          <div>
            <p className="font-semibold text-slate-900">{it.title || it.name || "Opleiding"}</p>
            <p className="text-xs text-slate-500">
              {it.institution || it.organisation || it.organization || "—"}
              {it.year ? ` • ${it.year}` : ""}
              {it.startDate || it.endDate ? ` • ${[it.startDate, it.endDate].filter(Boolean).join(" – ")}` : ""}
              {it.diplomaObtained ? " • diploma behaald" : ""}
            </p>
            {it.note ? <p className="mt-1 text-sm text-slate-700">{it.note}</p> : null}
          </div>
        )}
      />

      {/* Overige informatie en documenten */}
      <List
        title="Overige informatie en documenten"
        items={otherDocs}
        renderItem={(doc) => (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{doc.omschrijving || doc.title || "Document"}</p>
              <p className="text-xs text-slate-500">{doc.toelichting || doc.note || doc.datum || "—"}</p>
            </div>
            {doc.fileUrl ? (
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-brand-200 hover:text-brand-700"
              >
                Bekijken
              </a>
            ) : null}
          </div>
        )}
      />

      {/* Relevante werkervaring */}
      <List
        title="Relevante werkervaring"
        items={workExperienceList}
        renderItem={(it) => (
          <div>
            <p className="font-semibold text-slate-900">{it.role || it.title || "Functie"}</p>
            <p className="text-xs text-slate-500">{it.organisation || it.organization || "—"}</p>
            {it.note ? <p className="mt-1 text-sm text-slate-700">{it.note}</p> : null}
          </div>
        )}
      />
    </div>
  );
};

export default CustomerProfileView;
