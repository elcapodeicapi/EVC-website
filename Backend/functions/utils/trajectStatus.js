const TRAJECT_STATUS_LABELS = {
  COLLECTING: "Bewijzen verzamelen",
  REVIEW: "Ter beoordeling",
  QUALITY: "Ter kwaliteitscontrole",
  ASSESSMENT: "Ter beoordeling assessor",
  COMPLETE: "Beoordeling gereed",
  ARCHIVED: "In archief",
};

const TRAJECT_STATUS = Object.freeze({
  COLLECTING: TRAJECT_STATUS_LABELS.COLLECTING,
  REVIEW: TRAJECT_STATUS_LABELS.REVIEW,
  QUALITY: TRAJECT_STATUS_LABELS.QUALITY,
  ASSESSMENT: TRAJECT_STATUS_LABELS.ASSESSMENT,
  COMPLETE: TRAJECT_STATUS_LABELS.COMPLETE,
  ARCHIVED: TRAJECT_STATUS_LABELS.ARCHIVED,
  APPROVAL: TRAJECT_STATUS_LABELS.QUALITY,
});

const TRAJECT_STATUS_SEQUENCE = [
  TRAJECT_STATUS.COLLECTING,
  TRAJECT_STATUS.REVIEW,
  TRAJECT_STATUS.QUALITY,
  TRAJECT_STATUS.ASSESSMENT,
  TRAJECT_STATUS.COMPLETE,
  TRAJECT_STATUS.ARCHIVED,
];

const DEFAULT_TRAJECT_STATUS = TRAJECT_STATUS.COLLECTING;

const LEGACY_STATUS_MAP = new Map([
  ["collecting", TRAJECT_STATUS.COLLECTING],
  ["gathering", TRAJECT_STATUS.COLLECTING],
  ["pending", TRAJECT_STATUS.COLLECTING],
  ["active", TRAJECT_STATUS.COLLECTING],
  ["assigned", TRAJECT_STATUS.COLLECTING],
  ["bewijzen verzamelen", TRAJECT_STATUS.COLLECTING],
  ["review", TRAJECT_STATUS.REVIEW],
  ["onder review", TRAJECT_STATUS.REVIEW],
  ["ter beoordeling", TRAJECT_STATUS.REVIEW],
  ["awaiting_review", TRAJECT_STATUS.REVIEW],
  ["quality", TRAJECT_STATUS.QUALITY],
  ["kwaliteitscontrole", TRAJECT_STATUS.QUALITY],
  ["quality_check", TRAJECT_STATUS.QUALITY],
  ["ter kwaliteitscontrole", TRAJECT_STATUS.QUALITY],
  ["approval", TRAJECT_STATUS.QUALITY],
  ["awaiting_approval", TRAJECT_STATUS.QUALITY],
  ["ready_for_approval", TRAJECT_STATUS.QUALITY],
  ["assessor", TRAJECT_STATUS.ASSESSMENT],
  ["assessment", TRAJECT_STATUS.ASSESSMENT],
  ["assessor_review", TRAJECT_STATUS.ASSESSMENT],
  ["ter beoordeling assessor", TRAJECT_STATUS.ASSESSMENT],
  ["complete", TRAJECT_STATUS.COMPLETE],
  ["completed", TRAJECT_STATUS.COMPLETE],
  ["gereed", TRAJECT_STATUS.COMPLETE],
  ["beoordeling gereed", TRAJECT_STATUS.COMPLETE],
  ["archived", TRAJECT_STATUS.ARCHIVED],
  ["in archief", TRAJECT_STATUS.ARCHIVED],
  ["in_archief", TRAJECT_STATUS.ARCHIVED],
  ["archief", TRAJECT_STATUS.ARCHIVED],
]);

const ROLE_ALIASES = {
  user: "customer",
};

const STATUS_PIPELINE = [
  { status: TRAJECT_STATUS.COLLECTING, ownerRoles: ["customer", "user"] },
  { status: TRAJECT_STATUS.REVIEW, ownerRoles: ["coach"] },
  { status: TRAJECT_STATUS.QUALITY, ownerRoles: ["kwaliteitscoordinator"] },
  { status: TRAJECT_STATUS.ASSESSMENT, ownerRoles: ["assessor"] },
  { status: TRAJECT_STATUS.COMPLETE, ownerRoles: ["assessor"] },
  // Archived is terminal; admin can always transition (handled in canTransitionStatus)
  { status: TRAJECT_STATUS.ARCHIVED, ownerRoles: ["admin"] },
];

function normalizeTrajectStatus(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const direct = TRAJECT_STATUS_SEQUENCE.find(
    (status) => status.toLowerCase() === trimmed.toLowerCase()
  );
  if (direct) return direct;
  const legacy = LEGACY_STATUS_MAP.get(trimmed.toLowerCase());
  if (legacy) return legacy;
  return trimmed;
}

function getTrajectStatusOrder(value) {
  const normalized = normalizeTrajectStatus(value);
  if (!normalized) return Number.POSITIVE_INFINITY;
  const index = TRAJECT_STATUS_SEQUENCE.indexOf(normalized);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function getNextTrajectStatus(value) {
  const order = getTrajectStatusOrder(value);
  if (!Number.isFinite(order)) return null;
  return TRAJECT_STATUS_SEQUENCE[order + 1] || null;
}

function getPreviousTrajectStatus(value) {
  const order = getTrajectStatusOrder(value);
  if (!Number.isFinite(order)) return null;
  if (order <= 0) return null;
  return TRAJECT_STATUS_SEQUENCE[order - 1] || null;
}

function getStageForStatus(value) {
  const normalized = normalizeTrajectStatus(value);
  return STATUS_PIPELINE.find((stage) => stage.status === normalized) || null;
}

function normalizeRole(role) {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase();
  return ROLE_ALIASES[normalized] || normalized;
}

function canTransitionStatus({ fromStatus, toStatus, actorRole }) {
  const normalizedActor = normalizeRole(actorRole);
  if (!normalizedActor) return false;
  if (normalizedActor === "admin") return true;

  const fromNormalized = normalizeTrajectStatus(fromStatus) || DEFAULT_TRAJECT_STATUS;
  const toNormalized = normalizeTrajectStatus(toStatus);
  if (!toNormalized) return false;
  if (fromNormalized === toNormalized) return false;

  const fromIndex = TRAJECT_STATUS_SEQUENCE.indexOf(fromNormalized);
  const toIndex = TRAJECT_STATUS_SEQUENCE.indexOf(toNormalized);
  if (fromIndex === -1 || toIndex === -1) return false;

  const distance = Math.abs(fromIndex - toIndex);
  if (distance !== 1) return false;

  const stage = STATUS_PIPELINE[fromIndex];
  if (!stage) return false;

  return stage.ownerRoles.includes(normalizedActor);
}

module.exports = {
  TRAJECT_STATUS,
  TRAJECT_STATUS_SEQUENCE,
  DEFAULT_TRAJECT_STATUS,
  STATUS_PIPELINE,
  normalizeTrajectStatus,
  getTrajectStatusOrder,
  getNextTrajectStatus,
  getPreviousTrajectStatus,
  getStageForStatus,
  canTransitionStatus,
};
