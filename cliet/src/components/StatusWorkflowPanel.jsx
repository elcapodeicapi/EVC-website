import React, { useMemo } from "react";
import clsx from "clsx";
import {
  getNextTrajectStatus,
  getPreviousTrajectStatus,
  getStatusOwnerRoles,
  getTrajectStatusBadgeClass,
  getTrajectStatusLabel,
  normalizeTrajectStatus,
} from "../lib/trajectStatus";
import { Clock, RotateCcw, ArrowRight } from "lucide-react";

const ROLE_LABELS = {
  admin: "Beheerder",
  coach: "Begeleider",
  kwaliteitscoordinator: "Kwaliteitscoordinator",
  assessor: "Assessor",
  customer: "Kandidaat",
  user: "Kandidaat",
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDateTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return DATE_TIME_FORMATTER.format(date);
  } catch (_) {
    return date.toLocaleString();
  }
};

const StatusWorkflowPanel = ({ assignment, role, loading, error, onAdvance, onRewind }) => {
  const normalizedRole = (role || "").toLowerCase();
  const currentStatus = normalizeTrajectStatus(assignment?.status);

  const badgeClass = getTrajectStatusBadgeClass(currentStatus);
  const statusLabel = getTrajectStatusLabel(currentStatus);
  const nextStatus = getNextTrajectStatus(currentStatus);
  const previousStatus = getPreviousTrajectStatus(currentStatus);
  const ownerRoles = getStatusOwnerRoles(currentStatus);
  const isStageOwner = normalizedRole === "admin" || ownerRoles.includes(normalizedRole);

  const advanceLabel = nextStatus ? `Stap vooruit (${getTrajectStatusLabel(nextStatus)})` : "Geen volgende stap";
  const rewindLabel = previousStatus ? `Stuur terug (${getTrajectStatusLabel(previousStatus)})` : "Geen vorige stap";

  const lastChange = useMemo(() => {
    const history = Array.isArray(assignment?.statusHistory) ? assignment.statusHistory : [];
    if (history.length === 0) return null;
    return history[history.length - 1];
  }, [assignment?.statusHistory]);

  const recentHistory = useMemo(() => {
    const history = Array.isArray(assignment?.statusHistory) ? assignment.statusHistory : [];
    return history
      .slice(-5)
      .map((entry, index) => ({ ...entry, key: `${entry.status}-${entry.changedAtMillis || index}` }))
      .reverse();
  }, [assignment?.statusHistory]);

  const roleLabel = ROLE_LABELS[normalizedRole] || normalizedRole || "Rol";

  if (!currentStatus) {
    return (
      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Huidige status</p>
            <span className={clsx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold", getTrajectStatusBadgeClass(null))}>
              Onbekend
            </span>
            <p className="mt-1 text-xs text-slate-500">Er is nog geen status gevonden voor dit traject.</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">
              <RotateCcw className="h-4 w-4" />
              Stuur terug
            </button>
            <button type="button" disabled className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">
              <ArrowRight className="h-4 w-4" />
              Stuur door
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Huidige status</p>
          <span className={clsx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold", badgeClass)}>
            {statusLabel}
          </span>
          {lastChange ? (
            <p className="text-xs text-slate-500">
              Laatste wijziging {formatDateTime(lastChange.changedAt) || "onbekend"} door {ROLE_LABELS[lastChange.changedByRole] || lastChange.changedByRole || "onbekend"}
            </p>
          ) : null}
          <p className="text-xs text-slate-400">
            {isStageOwner
              ? `${roleLabel} kan deze stap beheren.`
              : `${roleLabel} kan deze stap alleen inzien.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRewind}
            disabled={!isStageOwner || !previousStatus || loading}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
              !isStageOwner || !previousStatus
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100"
            )}
            title={rewindLabel}
          >
            <RotateCcw className="h-4 w-4" />
            {previousStatus ? "Stuur terug" : "Niet beschikbaar"}
          </button>
          <button
            type="button"
            onClick={onAdvance}
            disabled={!isStageOwner || !nextStatus || loading}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
              !isStageOwner || !nextStatus
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 hover:bg-brand-100"
            )}
            title={advanceLabel}
          >
            <ArrowRight className="h-4 w-4" />
            {nextStatus ? "Stuur door" : "Geen vervolgstap"}
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      ) : null}
      {loading ? (
        <p className="mt-3 text-xs text-slate-400">Status wordt bijgewerkt...</p>
      ) : null}
      {recentHistory.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <Clock className="h-4 w-4" />
            Statusgeschiedenis
          </p>
          <ol className="mt-3 space-y-2 text-xs text-slate-600">
            {recentHistory.map((entry) => (
              <li key={entry.key} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{getTrajectStatusLabel(entry.status)}</span>
                  <span className="text-slate-400">{formatDateTime(entry.changedAt) || "Onbekend"}</span>
                </div>
                <div className="mt-1 text-slate-500">
                  {ROLE_LABELS[entry.changedByRole] || entry.changedByRole || "Onbekend"}
                  {entry.note ? ` • ${entry.note}` : ""}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
};

export default StatusWorkflowPanel;
