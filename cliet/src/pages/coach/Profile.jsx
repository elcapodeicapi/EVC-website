import React, { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Users as UsersIcon, ClipboardList, Mail, Phone, MapPin, CalendarDays, Clock } from "lucide-react";
import { normalizeTrajectStatus, TRAJECT_STATUS } from "../../lib/trajectStatus";

const CoachProfile = () => {
  const { coach, customers = [], assignments = [] } = useOutletContext() ?? {};
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
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-8 py-10 text-white shadow-card">
  <p className="text-sm uppercase tracking-[0.35em] text-white/70">Begeleidersprofiel</p>
        <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-3xl font-semibold">{coach?.name || coach?.email || "Begeleider"}</h2>
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
