import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, Clock, Search, UserRound } from "lucide-react";
import clsx from "clsx";
import { subscribeCoachCustomerProfile, subscribeCustomerProgress } from "../../lib/firestoreCoach";

const buildDefaultProgress = (customer) => ({
  trajectId: customer?.trajectId || null,
  trajectName: customer?.trajectName || customer?.trajectTitle || "",
  trajectCode: customer?.trajectCode || "",
  totalCompetencies: 0,
  completedCompetencies: 0,
  completionPercentage: 0,
  competencies: [],
  uploadsByCompetency: {},
});

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
});

const formatDateTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return dateTimeFormatter.format(date);
  } catch (_) {
    return date.toLocaleString();
  }
};

const formatDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return dateFormatter.format(date);
  } catch (_) {
    return date.toLocaleDateString();
  }
};

const formatRelative = (value) => {
  if (!value) return "Nog geen activiteit";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Onbekend";
  const diffMs = Date.now() - date.getTime();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (absMs < minute) return "Zojuist";
  if (absMs < hour) {
    const minutes = Math.round(absMs / minute);
    return `${minutes} minuut${minutes === 1 ? "" : "en"} geleden`;
  }
  if (absMs < day) {
    const hours = Math.round(absMs / hour);
    return `${hours} uur${hours === 1 ? "" : "en"} geleden`;
  }
  if (absMs < 7 * day) {
    const days = Math.round(absMs / day);
    return `${days} dag${days === 1 ? "" : "en"} geleden`;
  }
  const absolute = formatDateTime(date);
  return absolute || "Onbekend";
};

const Customers = () => {
  const { customers: customersFromContext = [] } = useOutletContext() ?? {};
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [progressMap, setProgressMap] = useState({});
  const [profileMap, setProfileMap] = useState({});
  const [statusExpanded, setStatusExpanded] = useState({});

  const sortedCustomers = useMemo(() => {
    return [...customersFromContext].sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
  }, [customersFromContext]);

  const filteredCustomers = useMemo(() => {
    if (!query) return sortedCustomers;
    const needle = query.toLowerCase();
    return sortedCustomers.filter((customer) => {
      const name = (customer?.name || customer?.email || "").toLowerCase();
      const traject = (customer?.trajectName || customer?.trajectTitle || "").toLowerCase();
      return name.includes(needle) || traject.includes(needle);
    });
  }, [sortedCustomers, query]);

  useEffect(() => {
    setProgressMap((prev) => {
      const next = {};
      sortedCustomers.forEach((customer) => {
        if (!customer?.id) return;
        if (!customer?.trajectId) {
          next[customer.id] = {
            data: buildDefaultProgress(customer),
            error: null,
            loading: false,
          };
          return;
        }
        next[customer.id] = prev[customer.id] || {
          data: buildDefaultProgress(customer),
          error: null,
          loading: Boolean(customer?.trajectId),
        };
      });
      return next;
    });

    const unsubscribers = sortedCustomers
      .filter((customer) => customer?.id && customer?.trajectId)
      .map((customer) =>
        subscribeCustomerProgress(customer.id, customer.trajectId, ({ data, error }) => {
          setProgressMap((prev) => ({
            ...prev,
            [customer.id]: {
              data: {
                ...buildDefaultProgress(customer),
                ...data,
                trajectName: data?.trajectName || customer?.trajectName || customer?.trajectTitle || "",
              },
              error: error || null,
              loading: false,
            },
          }));
        })
      );

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") unsubscribe();
      });
    };
  }, [sortedCustomers]);

  useEffect(() => {
    setProfileMap((prev) => {
      const next = {};
      sortedCustomers.forEach((customer) => {
        if (!customer?.id) return;
        next[customer.id] = prev[customer.id] || {
          data: null,
          error: null,
          loading: true,
        };
      });
      return next;
    });

    const unsubscribers = sortedCustomers
      .filter((customer) => customer?.id)
      .map((customer) =>
        subscribeCoachCustomerProfile(customer.id, ({ data, error }) => {
          setProfileMap((prev) => ({
            ...prev,
            [customer.id]: {
              data: data || null,
              error: error || null,
              loading: false,
            },
          }));
        })
      );

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") unsubscribe();
      });
    };
  }, [sortedCustomers]);

  const handleOpenDossier = (customerId) => {
    if (customerId) {
      navigate(`/coach/customers/${customerId}`);
    }
  };

  const toggleStatusPanel = (customerId) => {
    if (!customerId) return;
    setStatusExpanded((prev) => ({
      ...prev,
      [customerId]: !prev[customerId],
    }));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Mijn klanten</h2>
          <p className="text-sm text-slate-500">Volg realtime de voortgang per traject en bekijk bewijsstukken per competentie.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zoek op naam of traject"
            className="h-10 w-full min-w-[220px] rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </header>

      {sortedCustomers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
          Er zijn nog geen klanten aan je gekoppeld.
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-400">
          Geen klanten gevonden voor deze zoekopdracht.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCustomers.map((customer) => {
            const progress = progressMap[customer.id];
            const progressData = progress?.data || buildDefaultProgress(customer);
            const percent = Math.round(Math.min(100, Math.max(0, progressData?.completionPercentage ?? 0)));
            const profileEntry = profileMap[customer.id];
            const profile = profileEntry?.data || null;
            const evc = profile?.evcTrajectory || {};
            const voluntary = Boolean(evc?.voluntaryParticipation);
            const lastActivityLabel = formatRelative(customer?.lastActivity);
            const lastLogin = formatDateTime(customer?.lastActivity) || "Nog niet ingelogd";
            const qualification = evc?.qualification || {};
            const progressLabel = progress?.loading
              ? "Voortgang laden..."
              : `${progressData.completedCompetencies} van ${progressData.totalCompetencies} competenties met bewijs`;
            const evcUpdatedLabel = evc?.updatedAt ? formatRelative(evc.updatedAt) : "Nog niet ingevuld";
            const domainsDisplay = (evc?.domains || "")
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
              .slice(0, 3)
              .join(", ");
            const qualificationSummary = (() => {
              const parts = [];
              if (qualification.name) parts.push(qualification.name);
              if (qualification.number) parts.push(`Niveau ${qualification.number}`);
              if (qualification.validity) {
                const formattedValidity = formatDate(qualification.validity);
                parts.push(formattedValidity ? `geldig tot ${formattedValidity}` : qualification.validity);
              }
              return parts.length > 0 ? parts.join(" • ") : "Nog geen dossiergegevens";
            })();
            const electives = (evc?.domains || "")
              .split(/\r?\n|,/)
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 3);
            const questionnaireName = profile?.questionnaires?.[0]?.name || profile?.questionnaire?.name || "Nog niet ingevuld";
            const totalUploads = Object.values(progressData?.uploadsByCompetency || {}).reduce(
              (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
              0
            );
            const loopbaanCompetency = (progressData?.competencies || []).find((competency) => {
              const haystack = `${competency?.title || ""} ${competency?.code || ""}`.toLowerCase();
              return haystack.includes("loopbaan") || haystack.includes("burgerschap");
            });
            const loopbaanUploads = loopbaanCompetency
              ? progressData?.uploadsByCompetency?.[loopbaanCompetency.id] || []
              : [];
            const isStatusOpen = Boolean(statusExpanded[customer.id]);
            const displayName = customer.name || customer.email || "Onbekende klant";
            const photoURL = profile?.photoURL || customer?.photoURL || customer?.avatarUrl || null;
            const initials = displayName
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0].toUpperCase())
              .join("") || "??";
            const instrumentEntries = [
              {
                key: "intake",
                label: "Intake",
                icon: customer?.lastActivity ? "✅" : "❌",
                text: customer?.lastActivity ? `Laatst actief ${lastActivityLabel.toLowerCase()}` : "Nog niet ingevuld",
              },
              {
                key: "diplomas",
                label: "Opleidingen, diploma's en certificaten",
                icon: totalUploads > 0 ? "✅" : "❌",
                text:
                  totalUploads > 0
                    ? `${totalUploads} bewijsstuk${totalUploads === 1 ? "" : "ken"} toegevoegd`
                    : "Nog niet ingevuld",
              },
              {
                key: "experience",
                label: "Relevante werkervaring",
                icon: evc?.currentRole ? "✅" : "⚠️",
                text: evc?.currentRole ? `Functie geregistreerd (${evc.currentRole})` : "Nog geen werkervaring opgegeven",
              },
              {
                key: "otherDocs",
                label: "Overige informatie en documenten",
                icon: totalUploads > 2 ? "✅" : totalUploads > 0 ? "⚠️" : "❌",
                text:
                  totalUploads > 2
                    ? `${totalUploads} documenten beschikbaar`
                    : totalUploads > 0
                    ? "Beperkt aantal documenten"
                    : "Nog niet ingevuld",
              },
              {
                key: "loopbaan",
                label: "Loopbaan en burgerschap",
                icon: loopbaanUploads.length > 0 ? "✅" : "⚠️",
                text:
                  loopbaanUploads.length > 0
                    ? `${loopbaanUploads.length} bewijsstuk${loopbaanUploads.length === 1 ? "" : "ken"} toegevoegd`
                    : "Nog niet ingevuld",
              },
              {
                key: "cbi",
                label: "Criteriumgericht interview",
                icon: "⚠️",
                text: "Nog niet gepland",
              },
              {
                key: "werkplek",
                label: "Werkplekbezoek",
                icon: "⚠️",
                text: "Nog niet gepland",
              },
            ];

            return (
              <article
                key={customer.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-card transition hover:border-brand-200 hover:shadow-lg"
              >
                <div className="space-y-4">
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600 shadow-sm">
                        {photoURL ? (
                          <img src={photoURL} alt={displayName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center uppercase">{initials}</div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                        <p className="text-xs text-slate-500">{customer.email || "Geen e-mailadres"}</p>
                      </div>
                    </div>
                    <div className={clsx("rounded-full px-3 py-1 text-[11px] font-semibold", voluntary ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                      {voluntary ? "Vrijwillig" : "Verplicht"}
                    </div>
                  </header>

                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2 text-slate-600">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      <span>{evc?.contactPerson ? `Contactpersoon: ${evc.contactPerson}` : "Geen contactpersoon bekend"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>Laatste activiteit: {lastActivityLabel}</span>
                    </div>
                    <div>{evc?.currentRole ? `Huidige functie: ${evc.currentRole}` : "Geen functie geregistreerd"}</div>
                    <div>
                      Domeinen: {domainsDisplay || "Nog geen domeinen ingevuld"}
                    </div>
                    <div className="text-slate-400">
                      {evc?.updatedAt ? `EVC-details bijgewerkt ${evcUpdatedLabel}` : "EVC-details nog niet ingevuld"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Traject</p>
                    <div className="text-sm font-semibold text-slate-900">
                      {progressData?.trajectName || customer?.trajectName || customer?.trajectTitle || "Traject onbekend"}
                    </div>
                    {progressData?.trajectCode ? (
                      <div className="text-xs text-slate-500">Code: {progressData.trajectCode}</div>
                    ) : null}
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: percent > 0 ? `${percent}%` : "4px" }}
                      />
                    </div>
                    <div className="text-xs text-slate-500">{progressLabel}</div>
                  </div>

                  {profileEntry?.error || progress?.error ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                      {profileEntry?.error?.message || progress?.error?.message || "Kon alle gegevens niet laden."}
                    </div>
                  ) : null}
                </div>

                <footer className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDossier(customer.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
                  >
                    Overzicht client's traject
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStatusPanel(customer.id)}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                      isStatusOpen ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300" : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
                    )}
                  >
                    {isStatusOpen ? "Sluit status" : "Bekijk status"}
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Laatste update: {formatDateTime(customer?.updatedAt) || formatDateTime(customer?.createdAt) || "Onbekend"}
                  </span>
                </footer>

                {isStatusOpen ? (
                  <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="font-semibold text-slate-700">Laatst ingelogd op</p>
                        <p>{lastLogin}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Kwalificatiedossier</p>
                        <p>{qualificationSummary}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Keuzedelen</p>
                        {electives.length > 0 ? (
                          <ul className="mt-1 space-y-1">
                            {electives.map((item) => (
                              <li key={item} className="text-slate-600">
                                {item}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>Nog niet ingevuld</p>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Vragenlijst</p>
                        <p>{questionnaireName}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Vrijwillige deelname</p>
                        <p>{voluntary ? "Ja" : "Nee"}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Instrumenten</p>
                      <div className="mt-2 space-y-2">
                        {instrumentEntries.map((entry) => (
                          <div
                            key={entry.key}
                            className="grid grid-cols-[auto,1fr] items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <span className="text-base" role="img" aria-label={entry.icon === "✅" ? "voltooid" : entry.icon === "❌" ? "niet ingevuld" : "in bewerking"}>
                              {entry.icon}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-slate-700">{entry.label}</p>
                              <p className="text-[11px] text-slate-500">{entry.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Customers;
