import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { BellDot, Sparkles } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  subscribeCustomerProfileDetails,
  subscribeCustomerQuestionnaire,
} from "../../lib/firestoreCustomer";
import { subscribeCustomerProgress } from "../../lib/firestoreCoach";
import { get } from "../../lib/api";
import { getTrajectStatusLabel, getStatusOwnerRoles } from "../../lib/trajectStatus";
import { useResubscribingListener } from "../../hooks/useFirestoreListeners";
import { markMessagesAsRead } from "../../lib/firestoreMessages";
import { QUESTIONNAIRE_SECTION_IDS } from "../../lib/questionnaire";
import { subscribeUnreadMessagesForCustomer } from "../../lib/firestoreMessages";

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value.toDate === "function") {
    try {
      const converted = value.toDate();
      return Number.isNaN(converted.getTime()) ? null : converted;
    } catch (_) {
      return null;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) return null;
  try {
    return dateTimeFormatter.format(date);
  } catch (_) {
    return date.toLocaleString();
  }
};

const formatRelative = (value) => {
  const date = toDate(value);
  if (!date) return null;
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
  return formatDateTime(date);
};

const pluralise = (count, singular, plural) => {
  if (count === 1) return singular;
  if (plural) return plural;
  if (singular.endsWith("k")) return `${singular}ken`;
  if (singular.endsWith("s")) return `${singular}en`;
  return `${singular}s`;
};

const CustomerDashboard = () => {
  const { customer, coach, assignment } = useOutletContext();
  const customerId = customer?.id || customer?.firebaseUid || customer?.uid || null;
  const trajectId = customer?.trajectId || assignment?.trajectId || null;

  const [profileDetails, setProfileDetails] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(customerId));
  const [profileError, setProfileError] = useState(null);

  const [questionnaireRecord, setQuestionnaireRecord] = useState(null);
  const [questionnaireLoading, setQuestionnaireLoading] = useState(Boolean(customerId));
  const [questionnaireError, setQuestionnaireError] = useState(null);

  const [progressData, setProgressData] = useState(null);
  const [progressLoading, setProgressLoading] = useState(Boolean(customerId && trajectId));
  const [progressError, setProgressError] = useState(null);

  const [careerGoal, setCareerGoal] = useState({ content: "", updatedAt: null });
  const [careerGoalLoading, setCareerGoalLoading] = useState(Boolean(customerId));
  const [careerGoalError, setCareerGoalError] = useState(null);

  const [unreadMessages, setUnreadMessages] = useState([]);
  const [unreadError, setUnreadError] = useState(null);
  const [statusNotice, setStatusNotice] = useState(null);

  // Stable unread listener: keep last-known data on transient errors and resubscribe on auth changes
  useResubscribingListener(
    (helpers) => {
      if (!customerId) {
        setUnreadMessages([]);
        setUnreadError(null);
        return () => {};
      }
      return subscribeUnreadMessagesForCustomer(customerId, ({ data, error }) => {
        if (error) {
          // keep last-known list; route error to hook for resubscribe
          setUnreadError(error);
          helpers?.onError?.(error);
          return;
        }
        setUnreadError(null);
        setUnreadMessages(Array.isArray(data) ? data : []);
      });
    },
    [customerId],
    { name: "customer:unread" }
  );

  useEffect(() => {
    if (!customerId) {
      setProfileDetails(null);
      setProfileLoading(false);
      setProfileError(null);
      return () => {};
    }
    setProfileLoading(true);
    const unsubscribe = subscribeCustomerProfileDetails(customerId, ({ data, error }) => {
      if (error) {
        setProfileError(error);
        setProfileDetails(null);
      } else {
        setProfileError(null);
        setProfileDetails(data || null);
      }
      setProfileLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customerId]);

  useEffect(() => {
    if (!customerId) {
      setQuestionnaireRecord(null);
      setQuestionnaireLoading(false);
      setQuestionnaireError(null);
      return () => {};
    }
    setQuestionnaireLoading(true);
    const unsubscribe = subscribeCustomerQuestionnaire(customerId, ({ data, error }) => {
      if (error) {
        setQuestionnaireError(error);
        setQuestionnaireRecord(null);
      } else {
        setQuestionnaireError(null);
        setQuestionnaireRecord(data || null);
      }
      setQuestionnaireLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customerId]);

  useEffect(() => {
    if (!customerId || !trajectId) {
      setProgressData(null);
      setProgressLoading(false);
      setProgressError(null);
      return () => {};
    }
    setProgressLoading(true);
    const unsubscribe = subscribeCustomerProgress(customerId, trajectId, ({ data, error }) => {
      if (error) {
        setProgressError(error);
        setProgressData(null);
      } else {
        setProgressError(null);
        setProgressData(data || null);
      }
      setProgressLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customerId, trajectId]);

  useEffect(() => {
    let active = true;
    if (!customerId) {
      setCareerGoal({ content: "", updatedAt: null });
      setCareerGoalLoading(false);
      setCareerGoalError(null);
      return () => {
        active = false;
      };
    }

    const loadCareerGoal = async () => {
      setCareerGoalLoading(true);
      try {
        const data = await get("/customer/career-goal");
        if (!active) return;
        setCareerGoal({
          content: typeof data?.content === "string" ? data.content : "",
          updatedAt: data?.updatedAt || null,
        });
        setCareerGoalError(null);
      } catch (error) {
        if (!active) return;
        setCareerGoal({ content: "", updatedAt: null });
        setCareerGoalError(error);
      } finally {
        if (active) setCareerGoalLoading(false);
      }
    };

    loadCareerGoal();
    return () => {
      active = false;
    };
  }, [customerId]);

  const customerName = customer?.name?.split(" ")[0] || customer?.name || "kandidaat";
  const fullCustomerName = customer?.name || customerName;

  const ownerRoleLabels = useMemo(
    () => ({
      customer: "Jijzelf",
      user: "Jijzelf",
      coach: coach?.name ? `Begeleider ${coach.name}` : "Begeleider",
      kwaliteitscoordinator: "Kwaliteitscoördinator",
      assessor: "Assessor",
      admin: "Trajectbeheer",
    }),
    [coach?.name]
  );

  const statusLabel = assignment ? getTrajectStatusLabel(assignment.status) : "Nog niet gestart";
  const statusOwnerRoles = useMemo(
    () => getStatusOwnerRoles(assignment?.status || ""),
    [assignment?.status]
  );
  const statusOwnerLabel = useMemo(() => {
    if (!assignment) return "Nog niet toegewezen";
    if (!statusOwnerRoles.length) return "Trajectbeheer";
    return statusOwnerRoles.map((role) => ownerRoleLabels[role] || role).join(", ");
  }, [assignment, ownerRoleLabels, statusOwnerRoles]);

  // Determine the latest status change from assignment history or fallback to statusUpdatedAt
  const latestStatusChange = useMemo(() => {
    if (!assignment) return null;
    const history = Array.isArray(assignment.statusHistory) ? assignment.statusHistory : [];
    const lastEntry = history.length > 0 ? history[history.length - 1] : null;
    const changedAt = lastEntry?.changedAt || assignment.statusUpdatedAt || null;
    const status = lastEntry?.status || assignment.status || null;
    const changedByRole = lastEntry?.changedByRole || assignment.statusUpdatedByRole || null;
    const changedAtMillis = changedAt instanceof Date ? changedAt.getTime() : null;
    if (!status || !changedAtMillis) return null;
    return { status, changedAt, changedAtMillis, changedByRole };
  }, [assignment]);

  // Show a banner if there's a newer status change than the last-seen marker in localStorage
  useEffect(() => {
    if (!assignment || !latestStatusChange?.changedAtMillis) {
      setStatusNotice(null);
      return;
    }
    const key = `evc:lastSeenStatus:${assignment.id}`;
    let stored = null;
    try {
      const raw = localStorage.getItem(key);
      stored = raw ? parseInt(raw, 10) : null;
    } catch (_) {
      stored = null;
    }
    if (!stored) {
      // No marker yet: show the notice until the user marks it as read
      setStatusNotice(latestStatusChange);
      return;
    }
    if (latestStatusChange.changedAtMillis > stored) {
      setStatusNotice(latestStatusChange);
    } else {
      setStatusNotice(null);
    }
  }, [assignment?.id, latestStatusChange?.changedAtMillis]);

  const markStatusNoticeAsSeen = () => {
    if (!assignment || !latestStatusChange?.changedAtMillis) return;
    const key = `evc:lastSeenStatus:${assignment.id}`;
    try {
      localStorage.setItem(key, String(latestStatusChange.changedAtMillis));
    } catch (_) {}
    setStatusNotice(null);
  };

  const totalCompetencies = progressData?.totalCompetencies ?? 0;
  const completedCompetencies = progressData?.completedCompetencies ?? 0;
  const completionPercentage = progressData?.completionPercentage ?? 0;
  const trajectName = progressData?.trajectName || "";

  const totalUploads = useMemo(() => {
    if (!progressData?.uploadsByCompetency) return 0;
    return Object.values(progressData.uploadsByCompetency).reduce(
      (acc, value) => acc + (Array.isArray(value) ? value.length : 0),
      0
    );
  }, [progressData?.uploadsByCompetency]);

  const portfolioStatus = useMemo(() => {
    if (totalCompetencies > 0) {
      const proofLabel = pluralise(totalUploads, "bewijsstuk", "bewijsstukken");
      const competencySummary = `${completedCompetencies}/${totalCompetencies} competenties voorzien`;
      const uploadsSummary = `${totalUploads} ${proofLabel}`;
      return `${competencySummary} • ${uploadsSummary}`;
    }
    if (totalUploads > 0) {
      const proofLabel = pluralise(totalUploads, "bewijsstuk", "bewijsstukken");
      return `${totalUploads} ${proofLabel} geüpload`;
    }
    return "Nog niet gestart";
  }, [completedCompetencies, totalCompetencies, totalUploads]);

  const loopbaanUploadsCount = useMemo(() => {
    if (!progressData?.competencies) return 0;
    const match = progressData.competencies.find((competency) => {
      const haystack = `${competency?.title || ""} ${competency?.code || ""}`.toLowerCase();
      return haystack.includes("loopbaan") || haystack.includes("burgerschap");
    });
    if (!match) return 0;
    const uploads = progressData?.uploadsByCompetency?.[match.id];
    return Array.isArray(uploads) ? uploads.length : 0;
  }, [progressData?.competencies, progressData?.uploadsByCompetency]);

  const careerGoalContent = typeof careerGoal.content === "string" ? careerGoal.content.trim() : "";
  const loopbaanCompleted = careerGoalContent.length > 0;
  const careerGoalRelative = formatRelative(careerGoal.updatedAt);
  const loopbaanStatus = useMemo(() => {
    if (loopbaanCompleted) {
      return careerGoalRelative
        ? `Loopbaandoel opgeslagen • ${careerGoalRelative.toLowerCase()}`
        : "Loopbaandoel opgeslagen";
    }
    if (loopbaanUploadsCount > 0) {
      const proofLabel = pluralise(loopbaanUploadsCount, "bewijsstuk", "bewijsstukken");
      return `${loopbaanUploadsCount} ${proofLabel} toegevoegd`;
    }
    return "Nog niet ingevuld";
  }, [careerGoalRelative, loopbaanCompleted, loopbaanUploadsCount]);

  const questionnaireResponses = questionnaireRecord?.responses || {};
  const questionnaireCompleted = questionnaireRecord?.completed === true;
  const questionnaireUpdatedRelative = formatRelative(
    questionnaireRecord?.completedAt || questionnaireRecord?.updatedAt
  );
  const questionnaireFilledCount = useMemo(
    () =>
      QUESTIONNAIRE_SECTION_IDS.filter((sectionId) => {
        const value = questionnaireResponses?.[sectionId];
        return typeof value === "string" && value.trim().length > 0;
      }).length,
    [questionnaireResponses]
  );
  const questionnaireStatus = useMemo(() => {
    if (questionnaireCompleted) {
      if (questionnaireUpdatedRelative) {
        return `Compleet ingevuld • ${questionnaireUpdatedRelative.toLowerCase()}`;
      }
      return "Compleet ingevuld";
    }
    if (questionnaireFilledCount > 0) {
      return `${questionnaireFilledCount} van ${QUESTIONNAIRE_SECTION_IDS.length} onderdelen ingevuld`;
    }
    return "Nog niet ingevuld";
  }, [questionnaireCompleted, questionnaireFilledCount, questionnaireUpdatedRelative]);

  const voluntaryParticipation = Boolean(profileDetails?.evcTrajectory?.voluntaryParticipation);
  const currentRole = (profileDetails?.evcTrajectory?.currentRole || "").trim();
  const voluntaryStatus = voluntaryParticipation
    ? currentRole
      ? `Ja • huidige rol: ${currentRole}`
      : "Ja"
    : "Nog niet bevestigd";

  const lastActivity = customer?.lastActivity || customer?.lastLoggedIn || null;
  const lastActivityRelative = formatRelative(lastActivity);
  const lastActivityAbsolute = formatDateTime(lastActivity);
  const lastActivityStatus = lastActivity
    ? lastActivityRelative
      ? `${lastActivityRelative}${lastActivityAbsolute ? ` (${lastActivityAbsolute})` : ""}`
      : lastActivityAbsolute || "Onbekend"
    : "Nog geen activiteit geregistreerd";

  const hasCoach = Boolean(coach?.name || coach?.email);
  const coachStatus = hasCoach ? coach?.name || coach?.email : "Nog niet gekoppeld";
  const coachOwner = hasCoach ? coach?.email || coach?.name || "Begeleiding" : "Trajectbeheer";

  const statusRows = useMemo(
    () => [
      { label: "Trajectstatus", status: statusLabel, owner: statusOwnerLabel },
      { label: "Portfolio bewijslast", status: portfolioStatus, owner: "Jijzelf" },
      { label: "Loopbaan en burgerschap", status: loopbaanStatus, owner: "Jijzelf" },
      { label: "Vragenlijst Loopbaan & Burgerschap", status: questionnaireStatus, owner: "Jijzelf" },
      { label: "Vrijwillige deelname", status: voluntaryStatus, owner: "Jijzelf" },
      { label: "Laatste activiteit", status: lastActivityStatus, owner: "Jijzelf" },
      { label: "Begeleider", status: coachStatus, owner: coachOwner },
    ],
    [
      coachOwner,
      coachStatus,
      lastActivityStatus,
      loopbaanStatus,
      portfolioStatus,
      questionnaireStatus,
      statusLabel,
      statusOwnerLabel,
      voluntaryStatus,
    ]
  );

  const statusLoading = profileLoading || questionnaireLoading || progressLoading || careerGoalLoading;
  const statusError = profileError || questionnaireError || progressError || careerGoalError;
  const statusErrorMessage =
    typeof statusError === "string"
      ? statusError
      : statusError?.data?.error || statusError?.message || "Onbekende fout";

  const highlightChips = useMemo(() => {
    const chips = [`Status: ${statusLabel}`];
    if (totalCompetencies > 0) {
      chips.push(`Voortgang: ${completionPercentage}%`);
    }
    chips.push(`Bewijsstukken: ${totalUploads}`);
    if (hasCoach) {
      chips.push(`Begeleider: ${coachStatus}`);
    }
    return chips;
  }, [coachStatus, completionPercentage, hasCoach, statusLabel, totalCompetencies, totalUploads]);

  return (
    <div className="space-y-10">
      {statusNotice ? (
        <div className="rounded-3xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <BellDot className="mt-0.5 h-5 w-5 text-sky-600" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Je trajectstatus is gewijzigd naar {getTrajectStatusLabel(statusNotice.status)}
                </p>
                <p className="text-sky-800/80">
                  Wijziging: {formatRelative(statusNotice.changedAt) || "zojuist"}
                  {(() => {
                    const owners = getStatusOwnerRoles(statusNotice.status) || [];
                    const ownerLabel = owners.length
                      ? owners.map((r) => ownerRoleLabels[r] || r).join(", ")
                      : null;
                    return ownerLabel ? ` • Aan zet: ${ownerLabel}` : "";
                  })()}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <button
                type="button"
                onClick={markStatusNoticeAsSeen}
                className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
              >
                Markeer als gelezen
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {Array.isArray(unreadMessages) && unreadMessages.length > 0 ? (
        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <BellDot className="mt-0.5 h-5 w-5 text-amber-600" />
              <div className="space-y-1">
                <p className="font-semibold">Je hebt {unreadMessages.length} ongelezen {unreadMessages.length === 1 ? "bericht" : "berichten"}</p>
                <p className="text-amber-800/80">Ga naar Contact om je nieuwe {unreadMessages.length === 1 ? "bericht" : "berichten"} te bekijken. Deze melding blijft staan tot je ze opent of markeert als gelezen.</p>
              </div>
            </div>
            <div className="shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    // Group unread by thread and mark all as read for customer
                    const groups = unreadMessages.reduce((acc, m) => {
                      const tid = m.threadId;
                      if (!tid) return acc;
                      if (!acc[tid]) acc[tid] = [];
                      acc[tid].push(m.id);
                      return acc;
                    }, {});
                    await Promise.all(
                      Object.entries(groups).map(([threadId, ids]) =>
                        markMessagesAsRead({ threadId, messageIds: ids, readerRole: "customer" })
                      )
                    );
                  } catch (_) {
                    // best-effort; errors will not clear the banner
                  }
                }}
                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50"
              >
                Markeer als gelezen
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <section className="relative overflow-hidden rounded-3xl border border-evc-blue-200/40 bg-white shadow-sm">
        <div className="absolute -top-12 right-0 h-40 w-40 rounded-full bg-evc-blue-200/40 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-10 left-6 h-32 w-32 rounded-full bg-evc-blue-100/50 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 px-8 py-12 sm:px-12 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-evc-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Welkom
            </span>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Goed dat je er bent, {customerName}!
            </h1>
            <div className="max-w-2xl space-y-3 text-base text-slate-600">
              <p>
                Welkom {fullCustomerName}. Hier zie je in één oogopslag hoe jouw traject ervoor staat
                {trajectName ? ` (${trajectName})` : ""}.
              </p>
              <p>
                Werk stap voor stap je dossier bij. Zodra jij of je begeleider iets aanpast, verschijnt het direct op deze pagina.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
              {highlightChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 font-medium"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Stand van zaken</h2>
            <p className="text-sm text-slate-500">
              Actuele status van je traject en wie aan zet is voor de volgende stap.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-evc-blue-200 bg-evc-blue-50/60">
          {statusError ? (
            <div className="px-4 py-6 text-sm text-red-700">{statusErrorMessage}</div>
          ) : statusLoading ? (
            <div className="flex justify-center px-4 py-6">
              <LoadingSpinner label="Gegevens laden" />
            </div>
          ) : statusRows.length > 0 ? (
            <table className="min-w-full divide-y divide-evc-blue-200 text-sm text-evc-blue-900">
              <thead className="bg-evc-blue-100/60 text-left text-xs font-semibold uppercase tracking-[0.2em] text-evc-blue-700">
                <tr>
                  <th scope="col" className="px-4 py-3">Wat?</th>
                  <th scope="col" className="px-4 py-3">Stand van zaken</th>
                  <th scope="col" className="px-4 py-3">Door wie?</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map((row) => (
                  <tr key={row.label} className="odd:bg-white even:bg-evc-blue-50/50">
                    <td className="whitespace-pre-wrap px-4 py-3 font-medium text-slate-800">{row.label}</td>
                    <td className="px-4 py-3 text-slate-700">{row.status}</td>
                    <td className="px-4 py-3 text-slate-700">{row.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-6 text-sm text-slate-600">Nog geen gegevens beschikbaar.</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CustomerDashboard;

