export const TRAJECT_STATUS = Object.freeze({
  COLLECTING: "Bewijzen verzamelen",
  REVIEW: "Ter beoordeling",
  APPROVAL: "Ter goedkeuring",
  COMPLETE: "Beoordeling gereed",
});

export const TRAJECT_STATUS_SEQUENCE = [
  TRAJECT_STATUS.COLLECTING,
  TRAJECT_STATUS.REVIEW,
  TRAJECT_STATUS.APPROVAL,
  TRAJECT_STATUS.COMPLETE,
];

export const DEFAULT_TRAJECT_STATUS = TRAJECT_STATUS.COLLECTING;

const LEGACY_STATUS_MAP = new Map([
  ["pending", TRAJECT_STATUS.COLLECTING],
  ["active", TRAJECT_STATUS.COLLECTING],
  ["assigned", TRAJECT_STATUS.COLLECTING],
  ["in_progress", TRAJECT_STATUS.COLLECTING],
  ["open", TRAJECT_STATUS.COLLECTING],
  ["todo", TRAJECT_STATUS.COLLECTING],
  ["review", TRAJECT_STATUS.REVIEW],
  ["under_review", TRAJECT_STATUS.REVIEW],
  ["awaiting_review", TRAJECT_STATUS.REVIEW],
  ["approval", TRAJECT_STATUS.APPROVAL],
  ["awaiting_approval", TRAJECT_STATUS.APPROVAL],
  ["ready_for_approval", TRAJECT_STATUS.APPROVAL],
  ["completed", TRAJECT_STATUS.COMPLETE],
  ["done", TRAJECT_STATUS.COMPLETE],
  ["finished", TRAJECT_STATUS.COMPLETE],
  ["approved", TRAJECT_STATUS.COMPLETE],
  ["archived", TRAJECT_STATUS.COMPLETE],
  ["gereed", TRAJECT_STATUS.COMPLETE],
]);

const STATUS_BADGE_CLASSES = {
  [TRAJECT_STATUS.COLLECTING]: "bg-amber-100 text-amber-700 border border-amber-200",
  [TRAJECT_STATUS.REVIEW]: "bg-sky-100 text-sky-700 border border-sky-200",
  [TRAJECT_STATUS.APPROVAL]: "bg-violet-100 text-violet-700 border border-violet-200",
  [TRAJECT_STATUS.COMPLETE]: "bg-emerald-100 text-emerald-700 border border-emerald-200",
};

export function normalizeTrajectStatus(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const directMatch = TRAJECT_STATUS_SEQUENCE.find(
    (status) => status.toLowerCase() === trimmed.toLowerCase()
  );
  if (directMatch) return directMatch;
  const legacyMatch = LEGACY_STATUS_MAP.get(trimmed.toLowerCase());
  if (legacyMatch) return legacyMatch;
  return trimmed;
}

export function getTrajectStatusOrder(value) {
  const normalized = normalizeTrajectStatus(value);
  if (!normalized) return Number.POSITIVE_INFINITY;
  const index = TRAJECT_STATUS_SEQUENCE.indexOf(normalized);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

export function getTrajectStatusBadgeClass(value) {
  const normalized = normalizeTrajectStatus(value);
  if (!normalized) return "bg-slate-100 text-slate-500 border border-slate-200";
  return STATUS_BADGE_CLASSES[normalized] || "bg-slate-100 text-slate-500 border border-slate-200";
}

export function getTrajectStatusLabel(value) {
  const normalized = normalizeTrajectStatus(value);
  return normalized || "Onbekend";
}

export function getTrajectStatusMeta(value) {
  const normalized = normalizeTrajectStatus(value);
  return {
    value: normalized,
    label: normalized || "Onbekend",
    badgeClass: getTrajectStatusBadgeClass(normalized),
  };
}

export function isCollectingStatus(value) {
  return normalizeTrajectStatus(value) === TRAJECT_STATUS.COLLECTING;
}

export function isReviewStatus(value) {
  return normalizeTrajectStatus(value) === TRAJECT_STATUS.REVIEW;
}

export function isApprovalStatus(value) {
  return normalizeTrajectStatus(value) === TRAJECT_STATUS.APPROVAL;
}

export function isCompletedStatus(value) {
  return normalizeTrajectStatus(value) === TRAJECT_STATUS.COMPLETE;
}

export function getNextTrajectStatus(value) {
  const order = getTrajectStatusOrder(value);
  if (!Number.isFinite(order)) return null;
  const next = TRAJECT_STATUS_SEQUENCE[order + 1];
  return next || null;
}
