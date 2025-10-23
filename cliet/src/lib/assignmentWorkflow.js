import { post } from "./api";
import { normalizeTrajectStatus } from "./trajectStatus";

export async function updateAssignmentStatus({ customerId, status, note, coachId, assessorId }) {
  if (!customerId) {
    throw new Error("customerId is verplicht");
  }
  const resolvedStatus = normalizeTrajectStatus(status);
  if (!resolvedStatus) {
    throw new Error("Ongeldige status");
  }

  const payload = { status: resolvedStatus };
  if (note && typeof note === "string" && note.trim()) {
    payload.note = note.trim();
  }
  if (coachId && typeof coachId === "string") {
    payload.coachId = coachId;
  }
  if (assessorId && typeof assessorId === "string") {
    payload.assessorId = assessorId;
  }

  return post(`/assignments/${customerId}/status`, payload);
}
