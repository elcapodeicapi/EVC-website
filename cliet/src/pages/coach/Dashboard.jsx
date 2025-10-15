import React, { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Users as UsersIcon, ClipboardList, Clock } from "lucide-react";
import StatsCard from "../../components/StatsCard";

const CoachDashboard = () => {
  const {
    coach,
    customers = [],
    assignments = [],
    feedback = [],
  } = useOutletContext() ?? {};

  const displayName = useMemo(() => {
    const name = coach?.name || coach?.email || "Coach";
    return name;
  }, [coach]);

  const stats = useMemo(() => {
    const assignedCustomers = customers.length;
    const activeAssignments = assignments.filter((entry) => (entry?.status || "").toLowerCase() === "active").length;
    const pendingAssignments = assignments.filter((entry) => {
      const status = (entry?.status || "").toLowerCase();
      return status === "pending" || status === "open" || status === "todo";
    }).length;

    return [
      {
        id: "assigned-customers",
        title: "Assigned customers",
        value: String(assignedCustomers),
        icon: UsersIcon,
        variant: "brand",
      },
      {
        id: "active-assignments",
        title: "Active assignments",
        value: String(activeAssignments),
        icon: ClipboardList,
        variant: "emerald",
      },
      {
        id: "pending-reviews",
        title: "Pending reviews",
        value: String(pendingAssignments),
        icon: Clock,
        variant: "amber",
      },
    ];
  }, [assignments, customers]);

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
    const firstName = displayName?.split(" ")[0] || "Coach";
    return firstName;
  }, [displayName]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-8 py-10 text-white shadow-card">
        <p className="text-sm uppercase tracking-[0.35em] text-white/70">Welcome back</p>
        <h2 className="mt-2 text-3xl font-semibold">{`Hi ${greetingName}, ready to coach?`}</h2>
        <p className="mt-3 max-w-2xl text-sm text-white/80">
          Review the latest uploads, leave actionable feedback, and keep your customers moving forward in their EVC journey.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-900">Today at a glance</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <StatsCard key={stat.id} {...stat} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h3 className="text-base font-semibold text-slate-900">Recent feedback activity</h3>
        {recentFeedback.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nog geen feedback vastgelegd.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {recentFeedback.map((item) => (
              <article key={item.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{item.customerName || "Onbekende klant"}</p>
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
