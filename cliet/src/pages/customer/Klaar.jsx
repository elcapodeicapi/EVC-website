import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, Sparkles } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import { get } from "../../lib/api";
import { subscribeCustomerProfileDetails, updateCustomerAssignmentStatus } from "../../lib/firestoreCustomer";
import {
  getNextTrajectStatus,
  getTrajectStatusLabel,
  isCollectingStatus,
  normalizeTrajectStatus,
  TRAJECT_STATUS,
} from "../../lib/trajectStatus";

const VRAGENLIJST_STORAGE_NAMESPACE = "evc-vragenlijst-responses";
const VRAGENLIJST_SECTION_IDS = ["werknemer", "politiek", "consument", "sociaal", "vitaal", "loopbaan"];

const questionnaireIsComplete = (entry) => {
  if (!entry) return false;
  if (entry.completed === true || entry.isComplete === true) return true;
  const status = typeof entry.status === "string" ? entry.status.toLowerCase() : "";
  if (["completed", "done", "finished", "ingevuld", "voltooid"].includes(status)) return true;
  if (typeof entry.progress === "number" && entry.progress >= 100) return true;
  if (entry.completedAt || entry.submittedAt || entry.finishedAt) return true;
  if (Array.isArray(entry.answers) && entry.answers.length > 0) return true;
  if (Array.isArray(entry.responses) && entry.responses.length > 0) return true;
  if (entry.score !== undefined && entry.score !== null) return true;
  if (entry.name && (entry.updatedAt || entry.lastUpdated)) return true;
  return false;
};

const CustomerReady = () => {
  const navigate = useNavigate();
  const { customer, coach, assignment, loadingUser } = useOutletContext() ?? {};
  const customerId = customer?.firebaseUid || customer?.id || customer?.uid || null;
  const coachId = assignment?.coachId || coach?.firebaseUid || coach?.id || customer?.coachId || null;

  const normalizedStatus = normalizeTrajectStatus(assignment?.status);
  const currentStatusLabel = getTrajectStatusLabel(normalizedStatus);
  const canRequestReview = isCollectingStatus(normalizedStatus);
  const nextStatusLabel = getTrajectStatusLabel(getNextTrajectStatus(normalizedStatus) || TRAJECT_STATUS.REVIEW);

  const [profileDetails, setProfileDetails] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const [profileResume, setProfileResume] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [resumeError, setResumeError] = useState(null);

  const [careerGoal, setCareerGoal] = useState(null);
  const [careerGoalLoading, setCareerGoalLoading] = useState(true);
  const [careerGoalError, setCareerGoalError] = useState(null);
  const [vragenlijstDraft, setVragenlijstDraft] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);

  const vragenlijstStorageKey = useMemo(
    () => (customerId ? `${VRAGENLIJST_STORAGE_NAMESPACE}:${customerId}` : null),
    [customerId]
  );

  useEffect(() => {
    if (!customerId) {
      if (!loadingUser) {
        setProfileDetails(null);
        setProfileLoading(false);
        setProfileError(null);
      }
      return () => {};
    }

    let active = true;
    setProfileLoading(true);
    setProfileError(null);

    const unsubscribe = subscribeCustomerProfileDetails(customerId, ({ data, error }) => {
      if (!active) return;
      if (error) {
        const message = error?.message || "Kon profielgegevens niet laden.";
        setProfileError(message);
        setProfileLoading(false);
        return;
      }
      setProfileDetails(data || null);
      setProfileLoading(false);
    });

    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customerId, loadingUser]);

  useEffect(() => {
    if (!customerId) {
      if (!loadingUser) {
        setProfileResume(null);
        setResumeLoading(false);
        setResumeError(null);
      }
      return () => {};
    }

    let active = true;
    setResumeLoading(true);
    setResumeError(null);

    get("/customer/profile")
      .then((data) => {
        if (!active) return;
        setProfileResume(data || null);
        setResumeLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        const message = error?.data?.error || error?.message || "Kon profiel niet laden.";
        setResumeError(message);
        setResumeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customerId, loadingUser]);

  useEffect(() => {
    if (!customerId) {
      if (!loadingUser) {
        setCareerGoal(null);
        setCareerGoalLoading(false);
        setCareerGoalError(null);
      }
      return () => {};
    }

    let active = true;
    setCareerGoalLoading(true);
    setCareerGoalError(null);

    get("/customer/career-goal")
      .then((data) => {
        if (!active) return;
        setCareerGoal(data || null);
        setCareerGoalLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        const message = error?.data?.error || error?.message || "Kon loopbaandoel niet laden.";
        setCareerGoalError(message);
        setCareerGoalLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customerId, loadingUser]);

  useEffect(() => {
    if (!vragenlijstStorageKey) {
      setVragenlijstDraft(null);
      return undefined;
    }
    let active = true;
    try {
      const raw = localStorage.getItem(vragenlijstStorageKey);
      if (!active) return undefined;
      if (!raw) {
        setVragenlijstDraft(null);
      } else {
        const parsed = JSON.parse(raw);
        setVragenlijstDraft(parsed && typeof parsed === "object" ? parsed : null);
      }
    } catch (_) {
      if (active) setVragenlijstDraft(null);
    }
    return () => {
      active = false;
    };
  }, [vragenlijstStorageKey]);

  const voluntaryParticipation = Boolean(profileDetails?.evcTrajectory?.voluntaryParticipation);

  const workExperienceCount = useMemo(() => {
    if (!profileResume?.workExperience) return 0;
    if (!Array.isArray(profileResume.workExperience)) return 0;
    return profileResume.workExperience.filter((item) => {
      if (!item) return false;
      return Boolean(item.role || item.organisation || item.organization || item.note);
    }).length;
  }, [profileResume?.workExperience]);
  const hasWorkExperience = workExperienceCount > 0;

  const careerGoalContent = typeof careerGoal?.content === "string" ? careerGoal.content.trim() : "";
  const hasCareerGoal = careerGoalContent.length > 0;

  const questionnaireEntries = useMemo(() => {
    const items = [];
    if (Array.isArray(profileDetails?.questionnaires)) {
      items.push(...profileDetails.questionnaires);
    }
    if (Array.isArray(profileDetails?.questionnaireHistory)) {
      items.push(...profileDetails.questionnaireHistory);
    }
    if (profileDetails?.questionnaire) {
      items.push(profileDetails.questionnaire);
    }
    return items;
  }, [profileDetails?.questionnaires, profileDetails?.questionnaireHistory, profileDetails?.questionnaire]);

  const hasQuestionnaireFromProfile = useMemo(() => {
    if (profileDetails?.questionnaireCompleted === true) return true;
    return questionnaireEntries.some((entry) => questionnaireIsComplete(entry));
  }, [profileDetails?.questionnaireCompleted, questionnaireEntries]);

  const hasQuestionnaireDraft = useMemo(() => {
    if (!vragenlijstDraft || typeof vragenlijstDraft !== "object") return false;
    return VRAGENLIJST_SECTION_IDS.every((sectionId) => {
      const value = vragenlijstDraft[sectionId];
      if (typeof value !== "string") return false;
      return value.trim().length > 0;
    });
  }, [vragenlijstDraft]);

  const hasQuestionnaire = hasQuestionnaireFromProfile || hasQuestionnaireDraft;

  const isLoading = loadingUser || profileLoading || resumeLoading || careerGoalLoading;

  const requirementItems = useMemo(
    () => [
      {
        key: "voluntary",
        label: "Vrijwillige deelname bevestigd",
        completed: voluntaryParticipation,
        description: "Ga naar Mijn profiel > EVC-traject en vink aan dat je vrijwillig deelneemt.",
        actionLabel: "Open mijn profiel",
        onAction: () => navigate("/customer/profile"),
      },
      {
        key: "experience",
        label: "Werkervaring toegevoegd",
        completed: hasWorkExperience,
        description: "Voeg minimaal een relevante werkervaring toe aan je profiel.",
        actionLabel: "Werkervaring bekijken",
        onAction: () => navigate("/customer/profile"),
      },
      {
        key: "goal",
        label: "Loopbaandoel ingevuld",
        completed: hasCareerGoal,
        description: "Beschrijf je ambitie en motivatie op de pagina Mijn loopbaandoel.",
        actionLabel: "Loopbaandoel openen",
        onAction: () => navigate("/customer/career-goal"),
      },
      {
        key: "questionnaire",
        label: "Vragenlijst Loopbaan & Burgerschap afgerond",
        completed: hasQuestionnaire,
        description: "Vul de volledige vragenlijst in en bespreek je antwoorden met je begeleider.",
        actionLabel: "Open vragenlijst",
        onAction: () => navigate("/customer/vragenlijst"),
      },
    ],
    [hasCareerGoal, hasQuestionnaire, hasWorkExperience, navigate, voluntaryParticipation]
  );

  const incompleteItems = requirementItems.filter((item) => !item.completed);
  const requirementsComplete = incompleteItems.length === 0;

  const disableSubmit = !assignment || !canRequestReview || !requirementsComplete || submitting;

  const handleSubmit = async () => {
    if (disableSubmit || !customerId) return;
    setSubmitting(true);
    setSubmissionError(null);
    setSubmissionMessage(null);

    try {
      await updateCustomerAssignmentStatus({
        customerId,
        coachId: coachId || undefined,
        status: TRAJECT_STATUS.REVIEW,
      });
      setSubmissionMessage("Je portfolio is verstuurd naar je begeleider voor beoordeling.");
    } catch (error) {
      const message = error?.message || "Kon de status niet bijwerken.";
      setSubmissionError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner label="Checklist laden" />;
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/customer/portfolio")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-evc-blue-600 transition hover:text-evc-blue-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar mijn portfolio
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-evc-blue-600">Portfolio gereedmelden</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Ben je klaar voor beoordeling?</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-500">
            Voordat je op <em>Klaar</em> drukt, controleer je of je alle vereisten hebt afgerond. Zodra je indient, ontvangt je begeleider een melding om je portfolio te beoordelen en klaar te zetten voor de assessor.
          </p>
        </div>
      </header>

      {profileError || resumeError || careerGoalError ? (
        <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-semibold">Niet alle gegevens konden worden geladen.</p>
            <p className="mt-1 text-amber-700">
              {profileError || resumeError || careerGoalError}
            </p>
          </div>
        </div>
      ) : null}

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3 rounded-2xl bg-evc-blue-50 px-4 py-3 text-sm text-evc-blue-900">
          <Sparkles className="mt-0.5 h-5 w-5" />
          <p>
            Neem de checklist rustig door. Heb je feedback ontvangen? Verwerk deze voordat je indient en controleer of alle documenten met duidelijke bestandsnamen zijn geupload.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Checklist voordat je indient</h2>
          <ul className="space-y-3">
            {requirementItems.map((item) => (
              <li
                key={item.key}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  {item.completed ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <Circle className="h-6 w-6 text-slate-400" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="mt-1 max-w-xl text-sm text-slate-500">{item.description}</p>
                  </div>
                </div>
                {item.actionLabel ? (
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-evc-blue-600 shadow-sm transition hover:bg-evc-blue-50 sm:w-auto"
                  >
                    {item.actionLabel}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {incompleteItems.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Nog te regelen: {incompleteItems.map((item) => item.label).join(", ")}. Zodra alle punten zijn afgerond, kun je je portfolio indienen.
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Alles klaar! Je kunt je portfolio nu aanbieden aan je begeleider.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-600">Huidige status</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{assignment ? currentStatusLabel : "Nog geen traject gekoppeld"}</p>
            {assignment ? (
              <p className="mt-2 text-sm text-slate-500">
                Na het indienen verandert je status naar <strong>{nextStatusLabel}</strong>. Je begeleider controleert je portfolio en zet het daarna klaar voor de assessor.
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Er is nog geen traject gekoppeld aan je account. Neem contact op met je begeleider of de administratie voor hulp.
              </p>
            )}
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-64">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disableSubmit}
              className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition focus:outline-none focus:ring-2 focus:ring-evc-blue-200 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                disableSubmit ? "bg-slate-400" : "bg-evc-blue-600 hover:bg-evc-blue-500"
              }`}
            >
              {submitting ? "Versturen..." : "Markeer portfolio als klaar"}
            </button>
            {submissionError ? (
              <p className="text-center text-xs text-red-600">{submissionError}</p>
            ) : null}
            {submissionMessage ? (
              <p className="text-center text-xs text-emerald-600">{submissionMessage}</p>
            ) : null}
            {!assignment || !canRequestReview ? (
              <p className="text-center text-xs text-slate-500">
                {assignment
                  ? "Je portfolio is al ingediend of in behandeling. Neem contact op met je begeleider voor de voortgang."
                  : "Wacht tot je traject is gekoppeld voordat je kunt indienen."}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CustomerReady;
