import React, { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Users as UsersIcon, ClipboardList, Clock, MessageCircle } from "lucide-react";
import StatsCard from "../../components/StatsCard";
import { normalizeTrajectStatus, TRAJECT_STATUS } from "../../lib/trajectStatus";

const CoachDashboard = () => {
  const {
    coach,
    customers = [],
    assignments = [],
    feedback = [],
    unreadMessageSummary,
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
      (statusSummary[TRAJECT_STATUS.APPROVAL] || 0);
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

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-8 py-10 text-white shadow-card">
        <p className="text-sm uppercase tracking-[0.35em] text-white/70">Welkom terug</p>
  <h2 className="mt-2 text-3xl font-semibold">{`Hoi ${greetingName}, klaar om te begeleiden?`}</h2>
        <p className="mt-3 max-w-2xl text-sm text-white/80">
          Bekijk de nieuwste uploads, geef gerichte feedback en houd je kandidaten in beweging tijdens hun EVC-traject.
        </p>
      </section>

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
