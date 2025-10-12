import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { get, put } from "../../lib/api";
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
};

const CustomerProfile = () => {
  const { customer, coach } = useOutletContext();
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const customerName = useMemo(() => customer?.name || form.name || "Jouw profiel", [customer?.name, form.name]);
  const emailAddress = form.email || customer?.email || "";

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

  if (loading) {
    return <LoadingSpinner label="Profiel laden" />;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-500">Profiel bewerken</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">{customerName}</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-500">
            Werk je persoonsgegevens en adresgegevens eenvoudig bij. Je coach ziet altijd de meest recente informatie.
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
