const STATUS_LABELS = {
  COLLECTING: "Bewijzen verzamelen",
  REVIEW: "Ter beoordeling",
  QUALITY: "Ter kwaliteitscontrole",
  ASSESSMENT: "Ter beoordeling assessor",
  COMPLETE: "Beoordeling gereed",
  ARCHIVED: "In archief",
};

export const TRAJECT_STATUS = Object.freeze({
  COLLECTING: STATUS_LABELS.COLLECTING,
  REVIEW: STATUS_LABELS.REVIEW,
  QUALITY: STATUS_LABELS.QUALITY,
  ASSESSMENT: STATUS_LABELS.ASSESSMENT,
  COMPLETE: STATUS_LABELS.COMPLETE,
  ARCHIVED: STATUS_LABELS.ARCHIVED,
  APPROVAL: STATUS_LABELS.QUALITY,
});

export const TRAJECT_STATUS_SEQUENCE = [
  TRAJECT_STATUS.COLLECTING,
  TRAJECT_STATUS.REVIEW,
  TRAJECT_STATUS.QUALITY,
  TRAJECT_STATUS.ASSESSMENT,
  TRAJECT_STATUS.COMPLETE,
  TRAJECT_STATUS.ARCHIVED,
];

export const DEFAULT_TRAJECT_STATUS = TRAJECT_STATUS.COLLECTING;

const LEGACY_STATUS_MAP = new Map([
  ["pending", TRAJECT_STATUS.COLLECTING],
  ["active", TRAJECT_STATUS.COLLECTING],
  ["assigned", TRAJECT_STATUS.COLLECTING],
  ["in_progress", TRAJECT_STATUS.COLLECTING],
  ["open", TRAJECT_STATUS.COLLECTING],
  ["todo", TRAJECT_STATUS.COLLECTING],
  ["bewijzen verzamelen", TRAJECT_STATUS.COLLECTING],
  ["review", TRAJECT_STATUS.REVIEW],
  ["under_review", TRAJECT_STATUS.REVIEW],
  ["awaiting_review", TRAJECT_STATUS.REVIEW],
  ["coach_review", TRAJECT_STATUS.REVIEW],
  ["approval", TRAJECT_STATUS.QUALITY],
  ["awaiting_approval", TRAJECT_STATUS.QUALITY],
  ["ready_for_approval", TRAJECT_STATUS.QUALITY],
  ["quality", TRAJECT_STATUS.QUALITY],
  ["quality_check", TRAJECT_STATUS.QUALITY],
  ["kwaliteitscontrole", TRAJECT_STATUS.QUALITY],
  ["ter goedkeuring", TRAJECT_STATUS.QUALITY],
  ["assessor", TRAJECT_STATUS.ASSESSMENT],
  ["assessment", TRAJECT_STATUS.ASSESSMENT],
  ["assessor_review", TRAJECT_STATUS.ASSESSMENT],
  ["assessor-review", TRAJECT_STATUS.ASSESSMENT],
  ["ter beoordeling assessor", TRAJECT_STATUS.ASSESSMENT],
  ["complete", TRAJECT_STATUS.COMPLETE],
  ["completed", TRAJECT_STATUS.COMPLETE],
  ["done", TRAJECT_STATUS.COMPLETE],
  ["finished", TRAJECT_STATUS.COMPLETE],
  ["approved", TRAJECT_STATUS.COMPLETE],
  ["archived", TRAJECT_STATUS.ARCHIVED],
  ["in archief", TRAJECT_STATUS.ARCHIVED],
  ["in_archief", TRAJECT_STATUS.ARCHIVED],
  ["archief", TRAJECT_STATUS.ARCHIVED],
  ["gereed", TRAJECT_STATUS.COMPLETE],
  ["afgerond", TRAJECT_STATUS.COMPLETE],
]);

const STATUS_BADGE_CLASSES = {
  [TRAJECT_STATUS.COLLECTING]: "bg-amber-100 text-amber-700 border border-amber-200",
  [TRAJECT_STATUS.REVIEW]: "bg-sky-100 text-sky-700 border border-sky-200",
  [TRAJECT_STATUS.QUALITY]: "bg-violet-100 text-violet-700 border border-violet-200",
  [TRAJECT_STATUS.ASSESSMENT]: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  [TRAJECT_STATUS.COMPLETE]: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  [TRAJECT_STATUS.ARCHIVED]: "bg-slate-100 text-slate-600 border border-slate-200",
};

export const TRAJECT_STATUS_PIPELINE = [
  { status: TRAJECT_STATUS.COLLECTING, ownerRoles: ["customer", "user"] },
  { status: TRAJECT_STATUS.REVIEW, ownerRoles: ["coach"] },
  { status: TRAJECT_STATUS.QUALITY, ownerRoles: ["kwaliteitscoordinator"] },
  { status: TRAJECT_STATUS.ASSESSMENT, ownerRoles: ["assessor"] },
  { status: TRAJECT_STATUS.COMPLETE, ownerRoles: ["assessor"] },
  // Archived is terminal; not assigned to regular owner roles. Admin can always transition.
  { status: TRAJECT_STATUS.ARCHIVED, ownerRoles: ["admin"] },
];

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

export function isQualityStatus(value) {
  return normalizeTrajectStatus(value) === TRAJECT_STATUS.QUALITY;
}

export function isAssessorStatus(value) {
  return normalizeTrajectStatus(value) === TRAJECT_STATUS.ASSESSMENT;
}

export function isCompletedStatus(value) {
  return normalizeTrajectStatus(value) === TRAJECT_STATUS.COMPLETE;
}

export function getNextTrajectStatus(value) {
  const order = getTrajectStatusOrder(value);
  if (!Number.isFinite(order)) return null;
  return TRAJECT_STATUS_SEQUENCE[order + 1] || null;
}

export function getPreviousTrajectStatus(value) {
  const order = getTrajectStatusOrder(value);
  if (!Number.isFinite(order)) return null;
  if (order <= 0) return null;
  return TRAJECT_STATUS_SEQUENCE[order - 1] || null;
}

export function getStatusOwnerRoles(value) {
  const normalized = normalizeTrajectStatus(value);
  const stage = TRAJECT_STATUS_PIPELINE.find((entry) => entry.status === normalized);
  return stage ? stage.ownerRoles : [];
}

export function isReviewPipelineStatus(value) {
  const normalized = normalizeTrajectStatus(value);
  return [TRAJECT_STATUS.REVIEW, TRAJECT_STATUS.QUALITY, TRAJECT_STATUS.ASSESSMENT].includes(normalized);
}
