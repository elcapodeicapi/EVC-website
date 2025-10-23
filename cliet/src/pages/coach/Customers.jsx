import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, Clock, Loader2, LogIn, Search, UserRound } from "lucide-react";
import clsx from "clsx";
import { subscribeCoachCustomerProfile, subscribeCustomerProgress } from "../../lib/firestoreCoach";
import {
  getNextTrajectStatus,
  getPreviousTrajectStatus,
  getStatusOwnerRoles,
  getTrajectStatusBadgeClass,
  getTrajectStatusLabel,
  normalizeTrajectStatus,
  TRAJECT_STATUS,
} from "../../lib/trajectStatus";
import { updateAssignmentStatus } from "../../lib/assignmentWorkflow";
import { questionnaireIsComplete } from "../../lib/questionnaire";
import { ensureThread } from "../../lib/firestoreMessages";
import ModalForm from "../../components/ModalForm";
import { fetchUsersByRole } from "../../lib/firestoreAdmin";

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

const ROLE_LABELS = {
  admin: "Beheerder",
  coach: "Begeleider",
  kwaliteitscoordinator: "Kwaliteitscoordinator",
  assessor: "Assessor",
  customer: "Kandidaat",
  user: "Kandidaat",
};

const summarizeWorkExperience = (entries = [], { maxItems = 2 } = {}) => {
  if (!Array.isArray(entries)) {
    return { summary: "", count: 0 };
  }
  const normalized = entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const role = typeof entry.role === "string" ? entry.role.trim() : "";
      const organisation = typeof entry.organisation === "string" ? entry.organisation.trim() : typeof entry.organization === "string" ? entry.organization.trim() : "";
      const note = typeof entry.note === "string" ? entry.note.trim() : "";
      if (!role && !organisation && !note) return null;
      return { role, organisation, note };
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    return { summary: "", count: 0 };
  }

  const summaryParts = normalized.slice(0, maxItems).map((entry) => {
    if (entry.role && entry.organisation) return `${entry.role} @ ${entry.organisation}`;
    if (entry.role) return entry.role;
    if (entry.organisation) return entry.organisation;
    return entry.note;
  });

  return {
    summary: summaryParts.join(", "),
    count: normalized.length,
  };
};

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
  const {
    customers: customersFromContext = [],
    assignments: assignmentsFromContext = [],
    coach,
    role: contextRole = "coach",
    basePath = "/coach",
  } = useOutletContext() ?? {};
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [progressMap, setProgressMap] = useState({});
  const [profileMap, setProfileMap] = useState({});
  const [statusExpanded, setStatusExpanded] = useState({});
  const [pendingStatusCustomerId, setPendingStatusCustomerId] = useState(null);
  const [statusErrors, setStatusErrors] = useState({});
  const [pendingChatCustomerId, setPendingChatCustomerId] = useState(null);

  // Assessor selection modal state for coordinator per-card advance
  const [assessorModalOpen, setAssessorModalOpen] = useState(false);
  const [assessorsList, setAssessorsList] = useState([]);
  const [assessorLoading, setAssessorLoading] = useState(false);
  const [assessorError, setAssessorError] = useState(null);
  const [selectedAssessorId, setSelectedAssessorId] = useState("");
  const [assessorCustomerId, setAssessorCustomerId] = useState(null);

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

  const coachId = coach?.id || coach?.firebaseUid || coach?.uid || null;
  const normalizedRole = (contextRole || "coach").toLowerCase();

  const assignmentsByCustomer = useMemo(() => {
    const map = new Map();
    assignmentsFromContext.forEach((assignment) => {
      if (assignment?.customerId) {
        map.set(assignment.customerId, assignment);
      }
    });
    return map;
  }, [assignmentsFromContext]);

  const handleStatusUpdate = useCallback(
    async (customerId, targetStatus) => {
      if (!customerId || !targetStatus) return;
      const normalizedStatus = normalizeTrajectStatus(targetStatus);
      if (!normalizedStatus) return;
      setPendingStatusCustomerId(customerId);
      setStatusErrors((prev) => {
        if (!prev[customerId]) return prev;
        const next = { ...prev };
        delete next[customerId];
        return next;
      });
      try {
        const payload = { customerId, status: normalizedStatus };
        if (coachId) {
          payload.coachId = coachId;
        }
        await updateAssignmentStatus(payload);
      } catch (error) {
        const message = error?.data?.error || error?.message || "Het bijwerken van de status is mislukt.";
        setStatusErrors((prev) => ({ ...prev, [customerId]: message }));
      } finally {
        setPendingStatusCustomerId((prev) => (prev === customerId ? null : prev));
      }
    },
    [coachId]
  );

  const openAssessorSelection = useCallback(async (customerId) => {
    setAssessorCustomerId(customerId);
    setAssessorModalOpen(true);
    setAssessorsList([]);
    setAssessorError(null);
    setAssessorLoading(true);
    try {
      const list = await fetchUsersByRole("assessor");
      setAssessorsList(Array.isArray(list) ? list : []);
      setSelectedAssessorId((Array.isArray(list) && list[0]?.id) || "");
    } catch (error) {
      setAssessorError(error?.message || "Kon assessoren niet laden.");
    } finally {
      setAssessorLoading(false);
    }
  }, []);

  const confirmAssessorAdvance = useCallback(async () => {
    if (!assessorCustomerId) {
      setAssessorError("Geen kandidaat geselecteerd.");
      return;
    }
    if (!selectedAssessorId) {
      setAssessorError("Kies een assessor om door te sturen.");
      return;
    }
    setAssessorLoading(true);
    setAssessorError(null);
    try {
      await updateAssignmentStatus({
        customerId: assessorCustomerId,
        status: TRAJECT_STATUS.ASSESSMENT,
        coachId,
        assessorId: selectedAssessorId,
      });
      setAssessorModalOpen(false);
      setAssessorCustomerId(null);
    } catch (error) {
      setAssessorError(error?.data?.error || error?.message || "Doorsturen naar assessor is mislukt.");
    } finally {
      setAssessorLoading(false);
    }
  }, [assessorCustomerId, coachId, selectedAssessorId]);

  const handleAdvanceStatus = useCallback(
    (customerId, currentStatus) => {
      const nextStatus = getNextTrajectStatus(currentStatus);
      if (!nextStatus) return;
      // If this is the kwaliteitscoordinator moving to ASSESSMENT, prompt assessor selection first
      if (normalizedRole === "kwaliteitscoordinator" && nextStatus === TRAJECT_STATUS.ASSESSMENT) {
        openAssessorSelection(customerId);
        return;
      }
      handleStatusUpdate(customerId, nextStatus);
    },
    [handleStatusUpdate, normalizedRole, openAssessorSelection]
  );

  const handleRewindStatus = useCallback(
    (customerId, currentStatus) => {
      const previousStatus = getPreviousTrajectStatus(currentStatus);
      if (!previousStatus) return;
      handleStatusUpdate(customerId, previousStatus);
    },
    [handleStatusUpdate]
  );

  useEffect(() => {
    setProgressMap((prev) => {
      const next = {};
      sortedCustomers.forEach((customer) => {
        if (!customer?.id) return;
        const assignment = assignmentsFromContext.find((a) => a?.customerId === customer.id) || null;
        const effectiveTrajectId = customer?.trajectId || assignment?.trajectId || null;
        if (!effectiveTrajectId) {
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
          loading: true,
        };
      });
      return next;
    });

    const unsubscribers = sortedCustomers
      .map((customer) => {
        if (!customer?.id) return null;
        const assignment = assignmentsFromContext.find((a) => a?.customerId === customer.id) || null;
        const effectiveTrajectId = customer?.trajectId || assignment?.trajectId || null;
        if (!effectiveTrajectId) return null;
        return subscribeCustomerProgress(customer.id, effectiveTrajectId, ({ data, error }) => {
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
        });
      })
      .filter(Boolean);

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
      const normalizedBase = basePath.startsWith("/") ? basePath.replace(/\/$/, "") : `/${basePath.replace(/\/$/, "")}`;
      navigate(`${normalizedBase}/customers/${customerId}`);
    }
  };

  const toggleStatusPanel = (customerId) => {
    if (!customerId) return;
    setStatusExpanded((prev) => ({
      ...prev,
      [customerId]: !prev[customerId],
    }));
  };

  const handleStartChat = async (customer) => {
    if (!customer?.id || !coachId) return;
    setPendingChatCustomerId(customer.id);
    try {
      const threadId = await ensureThread({
        customerId: customer.id,
        coachId,
        customerProfile: { name: customer.name || customer.email || "Kandidaat", email: customer.email || "" },
        coachProfile: { name: coach?.name || coach?.email || "Begeleider", email: coach?.email || "" },
      });
      const normalizedBase = basePath.startsWith("/") ? basePath.replace(/\/$/, "") : `/${basePath.replace(/\/$/, "")}`;
      navigate(`${normalizedBase}/messages?thread=${encodeURIComponent(threadId)}`);
    } catch (_) {
      // Best effort; could show a toast/error UI here if desired
    } finally {
      setPendingChatCustomerId((prev) => (prev === customer.id ? null : prev));
    }
  };

  return (
    <>
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Mijn kandidaten</h2>
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
          Er zijn nog geen kandidaten aan je gekoppeld.
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-400">
          Geen kandidaten gevonden voor deze zoekopdracht.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCustomers.map((customer) => {
            const progress = progressMap[customer.id];
            const progressData = progress?.data || buildDefaultProgress(customer);
            const percent = Math.round(Math.min(100, Math.max(0, progressData?.completionPercentage ?? 0)));
            const profileEntry = profileMap[customer.id];
            const profilePayload = profileEntry?.data || null;
            const profileDetails = profilePayload?.profile || {};
            const resume = profilePayload?.resume || profileDetails?.resume || {};
            const evc = profilePayload?.evcTrajectory || profileDetails?.evcTrajectory || {};
            const careerGoal = profilePayload?.careerGoal || profileDetails?.careerGoal || null;
            const workExperienceSource = Array.isArray(profileDetails?.workExperience) && profileDetails.workExperience.length > 0
              ? profileDetails.workExperience
              : resume?.workExperience;
            const { summary: workExperienceSummary, count: workExperienceCount } = summarizeWorkExperience(workExperienceSource);
            const hasWorkExperience = workExperienceCount > 0;
            const careerGoalSummarySource = careerGoal?.summary || careerGoal?.description || careerGoal?.content || "";
            const hasCareerGoal = Boolean(careerGoalSummarySource && careerGoalSummarySource.trim().length > 0);
            const careerGoalUpdatedAt = careerGoal?.updatedAt instanceof Date ? careerGoal.updatedAt : careerGoal?.updatedAt ? new Date(careerGoal.updatedAt) : null;
            const careerGoalUpdatedLabel = careerGoalUpdatedAt ? formatRelative(careerGoalUpdatedAt) : null;
            const careerGoalUpdatedAbsolute = careerGoalUpdatedAt ? formatDateTime(careerGoalUpdatedAt) : null;
            const voluntary = Boolean(evc?.voluntaryParticipation);
            const lastActivityLabel = formatRelative(customer?.lastActivity);
            const lastLoginRelative = customer?.lastLoggedIn ? formatRelative(customer.lastLoggedIn) : "Nog niet ingelogd";
            const lastLoginAbsolute = customer?.lastLoggedIn ? formatDateTime(customer.lastLoggedIn) : null;
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
            const questionnaireEntries = [
              ...(Array.isArray(profileDetails?.questionnaires) ? profileDetails.questionnaires : []),
              ...(Array.isArray(profileDetails?.questionnaireHistory) ? profileDetails.questionnaireHistory : []),
              ...(Array.isArray(resume?.questionnaires) ? resume.questionnaires : []),
            ];
            const questionnaireUpdatedAt = (() => {
              const candidates = questionnaireEntries
                .map((entry) => entry?.updatedAt || entry?.submittedAt || entry?.completedAt || null)
                .filter(Boolean)
                .map((value) => (value instanceof Date ? value : new Date(value)))
                .filter((date) => !Number.isNaN(date.getTime()));
              if (candidates.length === 0) return null;
              return candidates.sort((a, b) => b.getTime() - a.getTime())[0];
            })();
            const questionnaireUpdatedRelative = questionnaireUpdatedAt ? formatRelative(questionnaireUpdatedAt) : null;
            const questionnaireUpdatedAbsolute = questionnaireUpdatedAt ? formatDateTime(questionnaireUpdatedAt) : null;
            const questionnaireRecord =
              profilePayload?.questionnaireRecord ||
              profileDetails?.questionnaire ||
              profilePayload?.questionnaire ||
              null;
            const questionnaireCompleted =
              Boolean(
                profileDetails?.questionnaireCompleted ||
                  profilePayload?.questionnaire?.completed ||
                  profilePayload?.questionnaireRecord?.completed
              ) ||
              (questionnaireRecord?.responses ? questionnaireIsComplete(questionnaireRecord.responses) : false);
            const loopbaanCompleted = hasCareerGoal;
            const uploadsByCompetency = progressData?.uploadsByCompetency || {};
            let lastUploadDate = null;
            Object.values(uploadsByCompetency).forEach((list) => {
              if (!Array.isArray(list)) return;
              list.forEach((upload) => {
                const candidate =
                  upload?.uploadedAt instanceof Date
                    ? upload.uploadedAt
                    : upload?.uploadedAt
                    ? new Date(upload.uploadedAt)
                    : null;
                if (!candidate || Number.isNaN(candidate.getTime())) return;
                if (!lastUploadDate || candidate > lastUploadDate) {
                  lastUploadDate = candidate;
                }
              });
            });
            const lastUploadRelative = lastUploadDate ? formatRelative(lastUploadDate) : "Nog geen uploads";
            const lastUploadAbsolute = lastUploadDate ? formatDateTime(lastUploadDate) : null;
            const isStatusOpen = Boolean(statusExpanded[customer.id]);
            const displayName = customer.name || customer.email || "Onbekende kandidaat";
            const photoURL =
              profileDetails?.photoURL ||
              profilePayload?.customer?.photoURL ||
              resume?.photoURL ||
              customer?.photoURL ||
              customer?.avatarUrl ||
              null;
            const initials =
              displayName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0].toUpperCase())
                .join("") || "??";
            const assignment = assignmentsByCustomer.get(customer.id) || null;
            const currentStatus = normalizeTrajectStatus(assignment?.status);
            const statusBadgeClass = getTrajectStatusBadgeClass(currentStatus);
            const statusLabel = currentStatus ? getTrajectStatusLabel(currentStatus) : "Nog geen status";
            const statusHistory = Array.isArray(assignment?.statusHistory) ? assignment.statusHistory : [];
            const lastStatusChange =
              statusHistory.length > 0
                ? statusHistory[statusHistory.length - 1]?.changedAt
                : assignment?.statusUpdatedAt || assignment?.updatedAt || null;
            const lastStatusRelative = lastStatusChange ? formatRelative(lastStatusChange) : "Nog geen statusupdate";
            const lastStatusAbsolute = lastStatusChange ? formatDateTime(lastStatusChange) : null;
            const nextStatus = getNextTrajectStatus(currentStatus);
            const previousStatus = getPreviousTrajectStatus(currentStatus);
            const ownerRoles = getStatusOwnerRoles(currentStatus);
            const isStageOwner = normalizedRole === "admin" || ownerRoles.includes(normalizedRole);
            const canAdvance = Boolean(nextStatus) && isStageOwner;
            const canRewind = Boolean(previousStatus) && isStageOwner;
            const isStatusPending = pendingStatusCustomerId === customer.id;
            const statusErrorMessage = statusErrors[customer.id] || null;
            const roleDisplayLabel = ROLE_LABELS[normalizedRole] || contextRole || "Begeleider";
            const recentStatusHistory = statusHistory.slice(-6).reverse();

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
                    <div
                      className={clsx(
                        "rounded-full px-3 py-1 text-[11px] font-semibold",
                        voluntary ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {voluntary ? "Vrijwillig" : "Verplicht"}
                    </div>
                  </header>

                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2 text-slate-600">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      <span>
                        {evc?.contactPerson
                          ? `Contactpersoon: ${evc.contactPerson}`
                          : "Geen contactpersoon bekend"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <LogIn className="h-4 w-4 text-slate-400" />
                      <span>Laatste login: {lastLoginRelative}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>Laatste activiteit: {lastActivityLabel}</span>
                    </div>
                    <div>{evc?.currentRole ? `Huidige functie: ${evc.currentRole}` : "Geen functie geregistreerd"}</div>
                    <div>Domeinen: {domainsDisplay || "Nog geen domeinen ingevuld"}</div>
                    <div className="text-slate-400">
                      {evc?.updatedAt ? `EVC-details bijgewerkt ${evcUpdatedLabel}` : "EVC-details nog niet ingevuld"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Traject</p>
                    <div className="text-sm font-semibold text-slate-900">
                      {progressData?.trajectName ||
                        customer?.trajectName ||
                        customer?.trajectTitle ||
                        "Traject onbekend"}
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

                  {assignment ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                            statusBadgeClass
                          )}
                        >
                          {statusLabel}
                        </span>
                        <span>{lastStatusRelative}</span>
                      </div>
                      {lastStatusAbsolute ? (
                        <p className="mt-1 text-slate-400">{lastStatusAbsolute}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-2 text-[11px] text-slate-400">
                      Nog geen trajectstatus gekoppeld
                    </div>
                  )}

                  {profileEntry?.error || progress?.error ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                      {profileEntry?.error?.message ||
                        progress?.error?.message ||
                        "Kon alle gegevens niet laden."}
                    </div>
                  ) : null}
                </div>

                <footer className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDossier(customer.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
                  >
                    Trajectoverzicht openen
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartChat(customer)}
                    disabled={pendingChatCustomerId === customer.id}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                      pendingChatCustomerId === customer.id
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-evc-blue-200 bg-evc-blue-50 text-evc-blue-700 hover:border-evc-blue-300 hover:bg-evc-blue-100"
                    )}
                  >
                    {pendingChatCustomerId === customer.id ? "Openen…" : "Stuur bericht"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStatusPanel(customer.id)}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                      isStatusOpen
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                        : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
                    )}
                  >
                    {isStatusOpen ? "Sluit status" : "Bekijk status"}
                  </button>
                  <span className="text-[11px] text-slate-400">
                    {lastStatusAbsolute ? `Status gewijzigd op ${lastStatusAbsolute}` : "Nog geen statuswijziging"}
                  </span>
                </footer>

                {isStatusOpen ? (
                  <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="font-semibold text-slate-700">Laatst ingelogd op</p>
                        <p>{lastLoginAbsolute || "Nog niet ingelogd"}</p>
                        {lastLoginAbsolute ? (
                          <p className="text-[11px] text-slate-400">{lastLoginRelative}</p>
                        ) : null}
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
                        <p className="font-semibold text-slate-700">Werkervaring</p>
                        <p>{hasWorkExperience ? workExperienceSummary : "Nog niet ingevuld"}</p>
                        {hasWorkExperience && workExperienceCount > 1 ? (
                          <p className="text-[11px] text-slate-400">{`${workExperienceCount} ervaringen geregistreerd`}</p>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Loopbaandoel</p>
                        <div className="mt-1 inline-flex items-center gap-2">
                          <span
                            className={clsx("text-lg leading-none", loopbaanCompleted ? "text-emerald-600" : "text-slate-300")}
                            role="img"
                            aria-label={loopbaanCompleted ? "Loopbaandoel vastgelegd" : "Loopbaandoel ontbreekt"}
                          >
                            {loopbaanCompleted ? "✅" : "❌"}
                          </span>
                          <span className={loopbaanCompleted ? "text-sm font-semibold text-emerald-700" : "text-sm text-slate-500"}>
                            {loopbaanCompleted ? "Vastgelegd" : "Nog niet ingevuld"}
                          </span>
                        </div>
                        {careerGoalUpdatedAbsolute ? (
                          <p className="text-[11px] text-slate-400">
                            {`Bijgewerkt ${careerGoalUpdatedAbsolute}`}
                            {careerGoalUpdatedLabel ? ` (${careerGoalUpdatedLabel.toLowerCase()})` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Vragenlijst</p>
                        <div className="mt-1 inline-flex items-center gap-2">
                          <span
                            className={clsx("text-lg leading-none", questionnaireCompleted ? "text-emerald-600" : "text-slate-300")}
                            role="img"
                            aria-label={questionnaireCompleted ? "Vragenlijst ingevuld" : "Vragenlijst nog niet ingevuld"}
                          >
                            {questionnaireCompleted ? "✅" : "❌"}
                          </span>
                          <span className={questionnaireCompleted ? "text-sm font-semibold text-emerald-700" : "text-sm text-slate-500"}>
                            {questionnaireCompleted ? "Ingevuld" : "Nog niet ingevuld"}
                          </span>
                        </div>
                        {questionnaireUpdatedAbsolute ? (
                          <p className="text-[11px] text-slate-400">
                            {`Laatst bijgewerkt ${questionnaireUpdatedAbsolute}`}
                            {questionnaireUpdatedRelative ? ` (${questionnaireUpdatedRelative.toLowerCase()})` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Vrijwillige deelname</p>
                        <p>{voluntary ? "Ja" : "Nee"}</p>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Trajectstatus
                          </p>
                          <span
                            className={clsx(
                              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                              statusBadgeClass
                            )}
                          >
                            {statusLabel}
                          </span>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {lastStatusAbsolute
                              ? `Laatst bijgewerkt ${lastStatusAbsolute}`
                              : "Nog geen wijzigingen vastgelegd"}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {isStageOwner
                              ? `${roleDisplayLabel} kan deze stap beheren.`
                              : `${roleDisplayLabel} kan deze stap alleen inzien.`}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRewindStatus(customer.id, currentStatus)}
                            disabled={!canRewind || isStatusPending}
                            className={clsx(
                              "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                              !canRewind || isStatusPending
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100"
                            )}
                          >
                            Stuur terug
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(customer.id, currentStatus)}
                            disabled={!canAdvance || isStatusPending}
                            className={clsx(
                              "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                              !canAdvance || isStatusPending
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                : "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 hover:bg-brand-100"
                            )}
                          >
                            Stuur door
                          </button>
                        </div>
                      </div>

                      {isStatusPending ? (
                        <div className="inline-flex items-center gap-2 text-[11px] text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Status wordt bijgewerkt...
                        </div>
                      ) : null}

                      {statusErrorMessage ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-600">
                          {statusErrorMessage}
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Portfolio-voortgang
                          </p>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-brand-500 transition-all"
                              style={{ width: percent > 0 ? `${percent}%` : "4px" }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">{progressLabel}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Laatste upload
                          </p>
                          <p className="text-xs text-slate-600">{lastUploadAbsolute || "Nog geen uploads"}</p>
                          <p className="text-[11px] text-slate-400">
                            {lastUploadDate ? lastUploadRelative : "Voeg bewijs toe om voortgang te tonen."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {assignment ? (
                      recentStatusHistory.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Statusgeschiedenis
                          </p>
                          <ol className="mt-2 space-y-2">
                            {recentStatusHistory.map((entry, index) => {
                              const actorRole = (entry.changedByRole || "").toLowerCase();
                              const actorLabel = ROLE_LABELS[actorRole] || entry.changedByRole || "Onbekend";
                              return (
                                <li
                                  key={`${entry.status}-${entry.changedAtMillis || index}`}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-700">
                                      {getTrajectStatusLabel(entry.status)}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      {formatDateTime(entry.changedAt) || "Onbekend"}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-500">
                                    {actorLabel}
                                    {entry.note ? ` • ${entry.note}` : ""}
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">Nog geen statusgeschiedenis beschikbaar.</p>
                      )
                    ) : (
                      <p className="text-[11px] text-slate-400">Nog geen trajectstatus gekoppeld.</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
    <ModalForm
      open={assessorModalOpen}
      title="Kies assessor"
      description="Kies de assessor aan wie je dit traject wilt toewijzen."
      onClose={() => setAssessorModalOpen(false)}
      footer={
        <>
          <button
            type="button"
            onClick={() => setAssessorModalOpen(false)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={assessorLoading}
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={confirmAssessorAdvance}
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={assessorLoading || !selectedAssessorId}
          >
            Bevestigen
          </button>
        </>
      }
    >
      {assessorError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{assessorError}</p>
      ) : null}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Assessor</label>
        <select
          value={selectedAssessorId}
          onChange={(e) => setSelectedAssessorId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          disabled={assessorLoading}
        >
          <option value="">{assessorLoading ? "Laden..." : "Kies een assessor"}</option>
          {assessorsList.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name || user.email || user.id}
            </option>
          ))}
        </select>
      </div>
    </ModalForm>
    </>
  );
};

export default Customers;

// Assessor selection modal UI
// Render the modal at the end so it overlays the page
// Note: We place it outside the Customers component return; instead, inline include inside component would be better,
// but to keep minimal changes we append here using a portal-like approach would be ideal. For simplicity, include within component.
