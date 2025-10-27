import React, { useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Users as UsersIcon, ClipboardList, Clock, MessageCircle, BellRing } from "lucide-react";
import StatsCard from "../../components/StatsCard";
import {
  normalizeTrajectStatus,
  TRAJECT_STATUS,
  getStatusOwnerRoles,
  getTrajectStatusLabel,
} from "../../lib/trajectStatus";
import StatusWorkflowPanel from "../../components/StatusWorkflowPanel";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDateTime = (value) => {
  if (!(value instanceof Date)) return null;
  if (Number.isNaN(value.getTime())) return null;
  try {
    return DATE_TIME_FORMATTER.format(value);
  } catch (_) {
    return value.toLocaleString();
  }
};

const CoachDashboard = () => {
  const {
    coach,
    customers = [],
    assignments = [],
    feedback = [],
    unreadMessageSummary,
    selectedAssignment,
    selectedCustomer,
    setSelectedCustomerId,
    role: resolvedRole,
    statusWorkflow,
    statusUpdating,
    statusUpdateError,
  } = useOutletContext() ?? {};

  const displayName = useMemo(() => {
    const name = coach?.name || coach?.email || "Begeleider";
    return name;
  }, [coach]);

  const stats = useMemo(() => {
    const assignedCustomers = customers.length;
    const statusSummary = assignments.reduce((acc, entry) => {
      const status = normalizeTrajectStatus(entry?.status);
      if (!status) return acc;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const collectingCount = statusSummary[TRAJECT_STATUS.COLLECTING] || 0;
    const reviewPipelineCount =
      (statusSummary[TRAJECT_STATUS.REVIEW] || 0) +
      (statusSummary[TRAJECT_STATUS.QUALITY] || 0) +
      (statusSummary[TRAJECT_STATUS.ASSESSMENT] || 0);
    const unreadTotal = unreadMessageSummary?.total ?? 0;
    const unreadSenders = unreadMessageSummary?.uniqueSenders ?? 0;

    return [
      {
        id: "unread-messages",
        title: "Ongelezen berichten",
        value: String(unreadTotal),
        description:
          unreadTotal === 0
            ? "Geen ongelezen berichten"
            : `${unreadSenders} ${unreadSenders === 1 ? "afzender" : "afzenders"} wachten op reactie`,
        icon: MessageCircle,
        variant: unreadTotal === 0 ? "slate" : "amber",
      },
      {
        id: "assigned-customers",
        title: "Gekoppelde kandidaten",
        value: String(assignedCustomers),
        icon: UsersIcon,
        variant: "brand",
      },
      {
        id: "collecting",
        title: "Portfolios in voorbereiding",
        value: String(collectingCount),
        icon: ClipboardList,
        variant: "emerald",
      },
      {
        id: "review-pipeline",
        title: "Te beoordelen",
        value: String(reviewPipelineCount),
        icon: Clock,
        variant: "amber",
      },
    ];
  }, [assignments, customers, unreadMessageSummary]);

  const recentFeedback = useMemo(() => {
    return [...feedback]
      .sort((a, b) => {
        const timeA = a?.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
        const timeB = b?.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [feedback]);

  const greetingName = useMemo(() => {
    const firstName = displayName?.split(" ")[0] || "Begeleider";
    return firstName;
  }, [displayName]);

  const heroTitle = useMemo(() => {
    switch ((resolvedRole || "coach").toLowerCase()) {
      case "kwaliteitscoordinator":
        return `Hoi ${greetingName}, klaar om kwaliteit te bewaken?`;
      case "assessor":
        return `Hoi ${greetingName}, klaar voor je beoordelingen?`;
      default:
        return `Hoi ${greetingName}, klaar om te begeleiden?`;
    }
  }, [greetingName, resolvedRole]);

  const selectedCustomerName = useMemo(() => {
    if (!selectedCustomer) return null;
    return selectedCustomer.name || selectedCustomer.email || "Kandidaat";
  }, [selectedCustomer]);

  const handleAdvance = useCallback(() => statusWorkflow?.advance?.({}), [statusWorkflow]);
  const handleRewind = useCallback(() => statusWorkflow?.rewind?.({}), [statusWorkflow]);

  // Debug assignment/status rendering issues
  React.useEffect(() => {
    if (import.meta?.env?.VITE_DEBUG_STATUS === "true") {
      // eslint-disable-next-line no-console
      console.log("[coach:dashboard] selectedCustomer=", selectedCustomer?.id, selectedCustomer?.name);
      // eslint-disable-next-line no-console
      console.log("[coach:dashboard] selectedAssignment=", selectedAssignment ? {
        id: selectedAssignment.id,
        customerId: selectedAssignment.customerId,
        status: selectedAssignment.status,
      } : null);
    }
  }, [selectedAssignment, selectedCustomer]);

  const customerIndex = useMemo(() => {
    const map = new Map();
    customers.forEach((customer) => {
      if (!customer?.id) return;
      map.set(customer.id, customer);
    });
    return map;
  }, [customers]);

  const actionableAssignments = useMemo(() => {
    const normalizedRole = (resolvedRole || "coach").toLowerCase();
    return assignments
      .map((assignment) => {
        const status = normalizeTrajectStatus(assignment?.status);
        const ownerRoles = getStatusOwnerRoles(status);
        const customerId = assignment?.customerId || assignment?.id || null;
        if (!customerId || !ownerRoles.includes(normalizedRole)) return null;
        const customerInfo = customerIndex.get(customerId) || {};
        const statusUpdatedAt =
          assignment?.statusUpdatedAt instanceof Date ? assignment.statusUpdatedAt : null;
        return {
          id: assignment?.id || customerId,
          customerId,
          status,
          statusLabel: getTrajectStatusLabel(status),
          statusUpdatedAt,
          customerName: customerInfo.name || customerInfo.email || customerId,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const timeA = a.statusUpdatedAt instanceof Date ? a.statusUpdatedAt.getTime() : 0;
        const timeB = b.statusUpdatedAt instanceof Date ? b.statusUpdatedAt.getTime() : 0;
        return timeB - timeA;
      });
  }, [assignments, customerIndex, resolvedRole]);

  const handleSelectCustomer = useCallback(
    (customerId) => {
      if (!customerId || typeof setSelectedCustomerId !== "function") return;
      setSelectedCustomerId(customerId);
    },
    [setSelectedCustomerId]
  );

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-8 py-10 text-white shadow-card">
        <p className="text-sm uppercase tracking-[0.35em] text-white/70">Welkom terug</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{heroTitle}</h2>
        <p className="mt-3 max-w-2xl text-ms text-white/80">
          Bekijk de nieuwste uploads, geef gerichte feedback en houd je kandidaten in beweging tijdens hun EVC-traject.
        </p>
      </section>

      {actionableAssignments.length > 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-card">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="space-y-3 text-sm text-amber-900">
              <div>
                <p className="font-semibold">
                  {actionableAssignments.length === 1
                    ? "1 traject wacht op jouw actie"
                    : `${actionableAssignments.length} trajecten wachten op jouw actie`}
                </p>
                <p className="text-xs text-amber-700">
                  Kies een kandidaat om de volgende stap in de workflow te zetten.
                </p>
              </div>
              <ul className="space-y-2">
                {actionableAssignments.slice(0, 3).map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectCustomer(entry.customerId)}
                      className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      Open traject
                    </button>
                    <span className="font-medium">{entry.customerName}</span>
                    <span className="text-xs text-amber-700">
                      • {entry.statusLabel}
                      {entry.statusUpdatedAt ? ` • ${formatDateTime(entry.statusUpdatedAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {actionableAssignments.length > 3 ? (
                <p className="text-xs text-amber-700">
                  +{actionableAssignments.length - 3} andere trajecten wachten ook op actie.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {selectedAssignment ? (
        <StatusWorkflowPanel
          assignment={selectedAssignment}
          role={resolvedRole}
          loading={statusUpdating}
          error={statusUpdateError}
          onAdvance={handleAdvance}
          onRewind={handleRewind}
        />
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-card">
          {selectedCustomerName ? (
            <p>
              Geen opdrachtinformatie beschikbaar voor {selectedCustomerName}. Kies een andere kandidaat of controleer of er een traject is gekoppeld.
            </p>
          ) : (
            <p>Selecteer een kandidaat via de filter rechtsboven om de workflowstatus te beheren.</p>
          )}
        </section>
      )}

      <section>
        <h3 className="text-lg font-semibold text-slate-900">Vandaag in één oogopslag</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <StatsCard key={stat.id} {...stat} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h3 className="text-base font-semibold text-slate-900">Recente feedbackactiviteit</h3>
        {recentFeedback.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nog geen feedback vastgelegd.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {recentFeedback.map((item) => (
              <article key={item.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{item.customerName || "Onbekende kandidaat"}</p>
                  <p className="text-xs text-slate-500">{item.competencyId || "Competentie"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Feedback</p>
                  <p className="text-sm font-medium text-slate-700">{item.summary || item.content || "-"}</p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  {item.updatedAt ? item.updatedAt.toLocaleString() : ""}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CoachDashboard;
