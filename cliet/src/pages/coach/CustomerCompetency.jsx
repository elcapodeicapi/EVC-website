import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Mail,
  NotebookPen,
  Phone,
  Save,
  UserRound,
  Paperclip,
} from "lucide-react";
import clsx from "clsx";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  saveCoachCustomerNote,
  subscribeCoachCustomerNote,
  subscribeCoachCustomerProfile,
  subscribeCustomerProgress,
} from "../../lib/firestoreCoach";
import {
  ensureThread,
  subscribeThreadMessages,
  sendThreadMessage,
  markMessagesAsRead,
} from "../../lib/firestoreMessages";
import { resolveUploadDownloadUrl } from "../../lib/firestoreCustomer";
import {
  QUESTIONNAIRE_SECTIONS,
  QUESTIONNAIRE_SECTION_IDS,
  normalizeQuestionnaireResponses,
  questionnaireIsComplete,
} from "../../lib/questionnaire";

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
});

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

const statusToIcon = {
  completed: "✅",
  attention: "⚠️",
  missing: "❌",
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

const buildInstrumentEntries = ({
  lastActivity,
  totalUploads,
  voluntary,
  currentRole,
  loopbaanUploads,
  loopbaanCompleted,
  questionnaireCompleted,
  questionnaireUpdatedRelative,
  questionnaireSummary,
  hasWorkExperience,
  workExperienceSummary,
}) => {
  return [
    {
      key: "intake",
      label: "Intake",
      status: lastActivity ? "completed" : "missing",
      message: lastActivity
        ? `Laatst actief ${formatRelative(lastActivity).toLowerCase()}`
        : "Nog niet ingevuld",
    },
    {
      key: "diplomas",
      label: "Opleidingen, diploma's en certificaten",
      status: totalUploads > 0 ? "completed" : "missing",
      message:
        totalUploads > 0
          ? `${totalUploads} bewijsstuk${totalUploads === 1 ? "" : "ken"} geüpload`
          : "Nog niet ingevuld",
    },
    {
      key: "experience",
      label: "Relevante werkervaring",
      status: hasWorkExperience ? "completed" : currentRole ? "attention" : "missing",
      message: hasWorkExperience
        ? workExperienceSummary
        : currentRole
        ? `Functie geregistreerd (${currentRole})`
        : totalUploads > 0
        ? `${totalUploads} bewijsstuk${totalUploads === 1 ? "" : "ken"} geüpload`
        : "Nog geen werkervaring opgegeven",
    },
    {
      key: "loopbaan",
      label: "Loopbaan en burgerschap",
      status: loopbaanCompleted ? "completed" : loopbaanUploads > 0 ? "attention" : "missing",
      message: loopbaanCompleted
        ? "✅ Vastgelegd"
        : loopbaanUploads > 0
        ? `${loopbaanUploads} bewijsstuk${loopbaanUploads === 1 ? "" : "ken"} toegevoegd`
        : "Nog niet ingevuld",
    },
    {
      key: "questionnaire",
      label: "Vragenlijst",
      status: questionnaireCompleted ? "completed" : "missing",
      message: questionnaireCompleted
        ? `✅ Ingevuld${questionnaireUpdatedRelative ? ` • ${questionnaireUpdatedRelative.toLowerCase()}` : ""}`
        : questionnaireSummary || "Nog niet ingevuld",
    },
    {
      key: "voluntary",
      label: "Vrijwillige deelname",
      status: voluntary ? "completed" : "attention",
      message: voluntary ? "Ja" : "Nee",
    },
    {
      key: "cbi",
      label: "Criteriumgericht interview",
      status: "attention",
      message: "Nog niet gepland",
    },
    {
      key: "werkplek",
      label: "Werkplekbezoek",
      status: "attention",
      message: "Nog niet gepland",
    },
  ];
};

const CustomerTrajectOverview = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { customers = [], coach, basePath = "/coach", assignments = [] } = useOutletContext() ?? {};

  const customer = useMemo(
    () => customers.find((item) => item.id === customerId) || null,
    [customers, customerId]
  );

  const coachId = coach?.id || coach?.firebaseUid || coach?.uid || null;

  // Resolve assignment for this customer to get potential fallback fields like trajectId
  const relatedAssignment = useMemo(
    () => assignments.find((a) => a?.customerId === customerId) || null,
    [assignments, customerId]
  );

  const [activeSection, setActiveSection] = useState("overzicht");
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownCloseTimeoutRef = useRef(null);

  const cancelDropdownClose = () => {
    if (dropdownCloseTimeoutRef.current) {
      clearTimeout(dropdownCloseTimeoutRef.current);
      dropdownCloseTimeoutRef.current = null;
    }
  };

  const handleDropdownEnter = (key) => {
    cancelDropdownClose();
    setOpenDropdown(key);
  };

  const handleDropdownLeave = () => {
    cancelDropdownClose();
    dropdownCloseTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
      dropdownCloseTimeoutRef.current = null;
    }, 120);
  };
  useEffect(() => () => cancelDropdownClose(), []);

  const [profileState, setProfileState] = useState({ data: null, loading: true, error: null });
  const [progressState, setProgressState] = useState({ data: null, loading: false, error: null });

  const [noteRecord, setNoteRecord] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteStatus, setNoteStatus] = useState(null);

  const [expandedCompetencies, setExpandedCompetencies] = useState({});
  // Chat state for inline contact (shown under Kandidaat -> Contact)
  const [chatThreadId, setChatThreadId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [chatTitle, setChatTitle] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [chatFiles, setChatFiles] = useState([]);
  const [chatSending, setChatSending] = useState(false);

  useEffect(() => {
    if (!customerId) {
  setProfileState({ data: null, loading: false, error: new Error("Geen kandidaat-id") });
      return () => {};
    }
    setProfileState((prev) => ({ ...prev, loading: true }));
    const unsubscribe = subscribeCoachCustomerProfile(customerId, ({ data, error }) => {
      if (error) {
        setProfileState({ data: null, loading: false, error });
        return;
      }
      setProfileState({ data, loading: false, error: null });
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customerId]);

  const effectiveTrajectId = customer?.trajectId || relatedAssignment?.trajectId || null;

  useEffect(() => {
    if (!customer?.id || !effectiveTrajectId) {
      setProgressState({ data: null, loading: false, error: null });
      return () => {};
    }
    setProgressState({ data: null, loading: true, error: null });
    const unsubscribe = subscribeCustomerProgress(customer.id, effectiveTrajectId, ({ data, error }) => {
      setProgressState({ data: data || null, loading: false, error: error || null });
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [customer?.id, effectiveTrajectId]);

  // Ensure a 1:1 thread for this coach-customer pair once both IDs are known
  useEffect(() => {
    let cancelled = false;
    if (!coachId || !customerId) {
      setChatThreadId(null);
      return () => {};
    }
    setChatLoading(true);
    ensureThread({
      customerId,
      coachId,
      customerProfile: { name: customer?.name || customer?.email || "Kandidaat", email: customer?.email || "" },
      coachProfile: { name: coach?.name || coach?.email || "Begeleider", email: coach?.email || "" },
    })
      .then((id) => {
        if (!cancelled) {
          setChatThreadId(id);
          setChatError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setChatThreadId(null);
          setChatError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coachId, customerId, customer?.name, customer?.email, coach?.name, coach?.email]);

  // Subscribe to messages for this thread
  useEffect(() => {
    if (!chatThreadId) {
      setChatMessages([]);
      return () => {};
    }
    const unsubscribe = subscribeThreadMessages(chatThreadId, ({ data, error }) => {
      if (error) {
        setChatError(error);
        setChatMessages([]);
        return;
      }
      const records = Array.isArray(data) ? data : [];
      // Mark unread for coach as read
      const unreadForCoach = records.filter((m) => m.receiverId === coachId && !m.isReadByCoach);
      if (unreadForCoach.length > 0) {
        const ids = unreadForCoach.map((m) => m.id).filter(Boolean);
        if (ids.length > 0) {
          markMessagesAsRead({ threadId: chatThreadId, messageIds: ids, readerRole: "coach" }).catch(() => {});
          setChatMessages(records.map((m) => (ids.includes(m.id) ? { ...m, isReadByCoach: true } : m)));
          setChatError(null);
          return;
        }
      }
      setChatMessages(records);
      setChatError(null);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [chatThreadId, coachId]);

  const formattedChatMessages = useMemo(() => {
    return chatMessages.map((m) => ({
      ...m,
      isOwn: m.senderId === coachId,
      senderInitial: (m.senderName || "?").charAt(0).toUpperCase(),
      timestampLabel: m.timestamp instanceof Date ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(m.timestamp) : "",
      isUnreadForCoach: m.receiverId === coachId && !m.isReadByCoach,
    }));
  }, [chatMessages, coachId]);

  const handleSendChat = async (event) => {
    event?.preventDefault?.();
    if (!chatThreadId || !coachId || !customerId) return;
    const trimmedTitle = chatTitle.trim();
    const trimmedBody = chatBody.trim();
    if (!trimmedTitle && !trimmedBody) return;
    setChatSending(true);
    setChatError(null);
    try {
      await sendThreadMessage({
        threadId: chatThreadId,
        senderId: coachId,
        receiverId: customerId,
        senderRole: "coach",
        senderName: coach?.name || coach?.email || "Begeleider",
        receiverName: customer?.name || customer?.email || "Kandidaat",
        messageTitle: trimmedTitle,
        messageText: trimmedBody,
        files: chatFiles,
      });
      setChatTitle("");
      setChatBody("");
      setChatFiles([]);
    } catch (err) {
      setChatError(err);
    } finally {
      setChatSending(false);
    }
  };

  const handleChatFileChange = (event) => {
    const list = event.target.files;
    const selected = list && typeof list.length === "number" ? Array.from(list) : [];
    setChatFiles(selected);
  };

  useEffect(() => {
    if (!coachId || !customerId) {
      setNoteRecord(null);
      setNoteDraft("");
      setNoteStatus(null);
      setNoteLoading(false);
      return () => {};
    }
    setNoteLoading(true);
    const unsubscribe = subscribeCoachCustomerNote(coachId, customerId, ({ data, error }) => {
      if (error) {
        setNoteStatus({ type: "error", message: error.message || "Kon notitie niet laden" });
        setNoteLoading(false);
        return;
      }
      setNoteStatus(null);
      setNoteRecord(data || null);
      setNoteDraft(data?.text || "");
      setNoteLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [coachId, customerId]);

  useEffect(() => {
    const competencies = progressState.data?.competencies || [];
    setExpandedCompetencies((prev) => {
      if (!competencies.length) return {};
      const next = { ...competencies.reduce((acc, competency) => ({ ...acc, [competency.id]: false }), {}) };
      if (competencies.length > 0) {
        const firstId = competencies[0].id;
        next[firstId] = prev[firstId] ?? true;
      }
      return { ...next, ...prev };
    });
  }, [progressState.data?.competencies]);

  const profileData = profileState.data?.profile || {};
  const resumeData = profileState.data?.resume || profileData?.resume || {};
  const evc = profileState.data?.evcTrajectory || profileData.evcTrajectory || {};
  const profileCustomer = profileState.data?.customer || customer;
  const displayName = profileCustomer?.name || customer?.name || customer?.email || "Onbekende kandidaat";
  const photoURL = profileCustomer?.photoURL || profileData?.photoURL || customer?.photoURL || null;
  const customerInitials = useMemo(() => {
    const source = displayName || profileCustomer?.email || customer?.email || "";
    if (!source) return "??";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "??";
  }, [displayName, profileCustomer?.email, customer?.email]);

  const lastActivity = profileCustomer?.lastActivity || customer?.lastActivity || null;
  const lastLoggedIn = profileCustomer?.lastLoggedIn || customer?.lastLoggedIn || null;
  const lastLoginLabel = lastLoggedIn ? formatDateTime(lastLoggedIn) : "Nog niet ingelogd";
  const lastLoginRelative = lastLoggedIn ? formatRelative(lastLoggedIn) : null;
  const voluntary = Boolean(evc?.voluntaryParticipation);
  const qualification = evc?.qualification || {};
  const placeOfBirth = profileData?.placeOfBirth || profileData?.birthplace || resumeData?.placeOfBirth || "";
  const phoneNumber =
    profileData?.phone ||
    profileData?.phoneMobile ||
    resumeData?.phoneMobile ||
    resumeData?.phoneFixed ||
    customer?.phone ||
    "";
  const careerGoalRecord = profileData?.careerGoal || profileState.data?.careerGoal || null;
  const careerGoalUpdatedAt = careerGoalRecord?.updatedAt instanceof Date
    ? careerGoalRecord.updatedAt
    : careerGoalRecord?.updatedAt
    ? new Date(careerGoalRecord.updatedAt)
    : null;
  const careerGoalUpdatedAbsolute = careerGoalUpdatedAt ? formatDateTime(careerGoalUpdatedAt) : null;
  const careerGoalUpdatedRelative = careerGoalUpdatedAt ? formatRelative(careerGoalUpdatedAt) : null;
  const workExperienceEntries = useMemo(() => {
    const source = Array.isArray(profileData?.workExperience) && profileData.workExperience.length > 0
      ? profileData.workExperience
      : Array.isArray(resumeData?.workExperience)
      ? resumeData.workExperience
      : [];
    return source.filter((entry) => entry && (entry.role || entry.organisation || entry.organization || entry.note));
  }, [profileData?.workExperience, resumeData?.workExperience]);
  const { summary: workExperienceSummary, count: workExperienceCount } = useMemo(
    () => summarizeWorkExperience(workExperienceEntries),
    [workExperienceEntries]
  );
  const hasWorkExperience = workExperienceCount > 0;
  const qualificationSummary = useMemo(() => {
    const parts = [];
    if (qualification.name) parts.push(qualification.name);
    if (qualification.number) parts.push(`Niveau ${qualification.number}`);
    if (qualification.validity) {
      const validity = formatDate(qualification.validity);
      parts.push(validity ? `geldig tot ${validity}` : qualification.validity);
    }
    return parts.length > 0 ? parts.join(" • ") : "Nog geen dossiergegevens";
  }, [qualification.name, qualification.number, qualification.validity]);

  const progressData = progressState.data || null;
  const totalUploads = useMemo(() => {
    if (!progressData?.uploadsByCompetency) return 0;
    return Object.values(progressData.uploadsByCompetency).reduce(
      (acc, value) => acc + (Array.isArray(value) ? value.length : 0),
      0
    );
  }, [progressData?.uploadsByCompetency]);

  const loopbaanCompetency = useMemo(() => {
    if (!progressData?.competencies) return null;
    return progressData.competencies.find((competency) => {
      const haystack = `${competency?.title || ""} ${competency?.code || ""}`.toLowerCase();
      return haystack.includes("loopbaan") || haystack.includes("burgerschap");
    });
  }, [progressData?.competencies]);

  const loopbaanUploads = loopbaanCompetency
    ? progressData?.uploadsByCompetency?.[loopbaanCompetency.id] || []
    : [];
  const loopbaanCompleted = useMemo(() => {
    if (!careerGoalRecord || typeof careerGoalRecord !== "object") return false;
    const fields = [
      careerGoalRecord.summary,
      careerGoalRecord.description,
      careerGoalRecord.goal,
      careerGoalRecord.title,
      careerGoalRecord.content,
    ];
    return fields.some((value) => typeof value === "string" && value.trim().length > 0);
  }, [careerGoalRecord]);

  const questionnaireRecord = profileState.data?.questionnaire || profileData?.questionnaire || null;
  const questionnaireResponses = useMemo(() => {
    const source =
      questionnaireRecord?.responses && typeof questionnaireRecord.responses === "object"
        ? questionnaireRecord.responses
        : profileData?.questionnaire?.responses && typeof profileData.questionnaire.responses === "object"
        ? profileData.questionnaire.responses
        : {};
    return normalizeQuestionnaireResponses(source);
  }, [questionnaireRecord?.responses, profileData?.questionnaire?.responses]);
  const questionnaireCompleted = useMemo(
    () =>
      questionnaireRecord?.completed === true || questionnaireIsComplete(questionnaireResponses),
    [questionnaireRecord?.completed, questionnaireResponses]
  );
  const questionnaireUpdatedAt = useMemo(() => {
    const source =
      questionnaireRecord?.updatedAt ||
      questionnaireRecord?.completedAt ||
      profileData?.questionnaire?.updatedAt ||
      profileData?.questionnaire?.completedAt ||
      null;
    if (!source) return null;
    const date = source instanceof Date ? source : new Date(source);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [
    questionnaireRecord?.updatedAt,
    questionnaireRecord?.completedAt,
    profileData?.questionnaire?.updatedAt,
    profileData?.questionnaire?.completedAt,
  ]);
  const questionnaireUpdatedRelative = questionnaireUpdatedAt ? formatRelative(questionnaireUpdatedAt) : null;
  const questionnaireUpdatedAbsolute = questionnaireUpdatedAt ? formatDateTime(questionnaireUpdatedAt) : null;
  const questionnaireSummary = useMemo(() => {
    if (questionnaireCompleted) {
      return questionnaireUpdatedRelative
        ? `Compleet ingevuld • ${questionnaireUpdatedRelative.toLowerCase()}`
        : "Compleet ingevuld";
    }
    const filledCount = QUESTIONNAIRE_SECTION_IDS.filter((sectionId) => {
      const value = questionnaireResponses[sectionId];
      return typeof value === "string" && value.trim().length > 0;
    }).length;
    if (filledCount === 0) return "Nog niet ingevuld";
    return `${filledCount} van ${QUESTIONNAIRE_SECTION_IDS.length} onderdelen ingevuld`;
  }, [questionnaireCompleted, questionnaireResponses, questionnaireUpdatedRelative]);
  const questionnaireHasContent = useMemo(
    () =>
      QUESTIONNAIRE_SECTION_IDS.some((sectionId) => {
        const value = questionnaireResponses[sectionId];
        return typeof value === "string" && value.trim().length > 0;
      }),
    [questionnaireResponses]
  );
  const questionnaireSectionEntries = useMemo(
    () =>
      QUESTIONNAIRE_SECTIONS.map((section) => ({
        ...section,
        response: typeof questionnaireResponses[section.id] === "string" ? questionnaireResponses[section.id].trim() : "",
      })),
    [questionnaireResponses]
  );

  const instrumentEntries = useMemo(
    () =>
      buildInstrumentEntries({
        lastActivity,
        totalUploads,
        voluntary,
        currentRole: evc?.currentRole || profileData?.currentRole || null,
        loopbaanUploads: loopbaanUploads.length,
  loopbaanCompleted,
        questionnaireCompleted,
        questionnaireUpdatedRelative,
        questionnaireSummary,
        hasWorkExperience,
        workExperienceSummary,
      }),
    [
      lastActivity,
      totalUploads,
      voluntary,
      evc?.currentRole,
      profileData?.currentRole,
      loopbaanUploads.length,
  loopbaanCompleted,
      questionnaireCompleted,
      questionnaireUpdatedRelative,
      questionnaireSummary,
      hasWorkExperience,
      workExperienceSummary,
    ]
  );

  const checklistItems = useMemo(
    () => [
      {
        key: "voluntary",
        label: "Vrijwillige deelname",
        completed: voluntary,
        description: voluntary ? "Cliënt neemt vrijwillig deel" : "Nog niet bevestigd",
      },
      {
        key: "loopbaandoel",
        label: "Loopbaandoel vastgelegd",
        completed: loopbaanCompleted,
        description: profileData?.careerGoal?.title || "Nog geen loopbaandoel opgegeven",
      },
      {
        key: "questionnaire",
        label: "Vragenlijst ingevuld",
        completed: questionnaireCompleted,
        description: questionnaireSummary,
      },
      {
        key: "experience",
        label: "Werkervaring vastgelegd",
        completed: hasWorkExperience || Boolean(evc?.currentRole) || totalUploads > 0,
        description: hasWorkExperience
          ? workExperienceSummary
          : evc?.currentRole || (totalUploads > 0 ? "Er staat bewijs in het portfolio" : "Nog geen werkervaring ingevuld"),
      },
    ],
    [
      voluntary,
      profileData?.careerGoal?.title,
      profileData?.careerGoal?.summary,
      loopbaanCompleted,
      questionnaireCompleted,
      questionnaireSummary,
      evc?.currentRole,
      totalUploads,
      hasWorkExperience,
      workExperienceSummary,
    ]
  );

  const uploadsByCompetency = progressData?.uploadsByCompetency || {};
  const competencies = progressData?.competencies || [];

  // Build linked items by competency from profile/resume arrays
  const profileEducations = useMemo(() => {
    const primary = Array.isArray(profileData?.educations) && profileData.educations.length > 0 ? profileData.educations : [];
    const secondary = Array.isArray(resumeData?.educations) ? resumeData.educations : [];
    return primary.length > 0 ? primary : secondary;
  }, [profileData?.educations, resumeData?.educations]);
  const profileCertificates = useMemo(() => {
    const primary = Array.isArray(profileData?.certificates) && profileData.certificates.length > 0 ? profileData.certificates : [];
    const secondary = Array.isArray(resumeData?.certificates) ? resumeData.certificates : [];
    return primary.length > 0 ? primary : secondary;
  }, [profileData?.certificates, resumeData?.certificates]);
  const profileWork = useMemo(() => {
    const primary = Array.isArray(profileData?.workExperience) && profileData.workExperience.length > 0 ? profileData.workExperience : [];
    const secondary = Array.isArray(resumeData?.workExperience) ? resumeData.workExperience : [];
    return primary.length > 0 ? primary : secondary;
  }, [profileData?.workExperience, resumeData?.workExperience]);

  const linkedByCompetency = useMemo(() => {
    const map = {};
    const add = (section, items) => {
      (items || []).forEach((entry) => {
        const links = Array.isArray(entry.linkedCompetencies) ? entry.linkedCompetencies : [];
        links.forEach((compId) => {
          if (!map[compId]) map[compId] = [];
          map[compId].push({ ...entry, __section: section });
        });
      });
    };
    add("education", profileEducations);
    add("certificate", profileCertificates);
    add("work", profileWork);
    return map;
  }, [profileEducations, profileCertificates, profileWork]);

  const renderInstrumentEntries = () => (
    <div className="space-y-2">
      {instrumentEntries.map((entry) => (
        <div
          key={entry.key}
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
          <span className="text-lg" role="img" aria-hidden="true">
            {statusToIcon[entry.status] || "⚪"}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{entry.label}</p>
            <p className="text-xs text-slate-500">{entry.message}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const handleSaveNote = async () => {
    if (!coachId || !customerId) return;
    setNoteSaving(true);
    setNoteStatus({ type: "info", message: "Opslaan..." });
    try {
      await saveCoachCustomerNote({
        coachId,
        customerId,
        text: noteDraft,
        existingTimestamp: noteRecord?.timestamp || null,
      });
      setNoteStatus({ type: "success", message: "Notitie opgeslagen" });
    } catch (error) {
      setNoteStatus({ type: "error", message: error.message || "Opslaan mislukt" });
    } finally {
      setNoteSaving(false);
    }
  };

  if (!customer) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-500"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar kandidaten
        </button>
        <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
          Kandidaat niet gevonden.
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <section className="grid gap-6 rounded-3xl bg-white p-6 shadow-card lg:grid-cols-[220px,1fr]">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-28 w-28 overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-2xl font-semibold text-slate-600">
            {photoURL ? (
              <img src={photoURL} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center uppercase">{customerInitials}</div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{displayName}</h2>
            <p className="text-sm text-slate-500">{progressData?.trajectName || customer.trajectName || customer.trajectTitle || "Traject onbekend"}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Persoonlijk</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-700">Naam:</span> {customer.name || "Onbekend"}</p>
              <p><span className="font-semibold text-slate-700">Geboortedatum:</span> {profileData?.dateOfBirth ? formatDate(profileData.dateOfBirth) : "Onbekend"}</p>
              <p><span className="font-semibold text-slate-700">Geboorteplaats:</span> {placeOfBirth || "Onbekend"}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Contact</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> {customer.email || "Geen e-mailadres"}</p>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {phoneNumber || "Geen telefoonnummer"}</p>
              <p className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-slate-400" />
                <span>
                  Laatste login: {lastLoginLabel}
                  {lastLoginRelative ? ` (${lastLoginRelative})` : ""}
                </span>
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Deelname</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-700">Vrijwillige deelname:</span> {voluntary ? "Ja" : "Nee"}</p>
              <p><span className="font-semibold text-slate-700">Huidige functie:</span> {evc?.currentRole || "Onbekend"}</p>
              <p><span className="font-semibold text-slate-700">Werkervaring:</span> {hasWorkExperience ? workExperienceSummary : "Nog niet ingevuld"}</p>
              <p><span className="font-semibold text-slate-700">Kwalificatiedossier:</span> {qualificationSummary}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Instrumenten</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {renderInstrumentEntries()}
            </div>
          </div>
        </div>
      </section>

      {/* Chat UI now lives under Kandidaat -> Contact view */}

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Checklist</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {checklistItems.map((item) => (
            <div key={item.key} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <CheckCircle2 className={clsx("mt-1 h-5 w-5", item.completed ? "text-emerald-500" : "text-slate-300")}
              />
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderCandidateView = (view) => {
    switch (view) {
      case "candidate-profile":
        return (
          <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
            <header>
              <h3 className="text-lg font-semibold text-slate-900">Profiel zoals de kandidaat het ziet</h3>
              <p className="text-sm text-slate-500">Belangrijkste persoonsgegevens en trajectinformatie.</p>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-700">Naam:</span> {customer.name || "Onbekend"}</p>
                <p><span className="font-semibold text-slate-700">E-mail:</span> {customer.email || "Onbekend"}</p>
                <p><span className="font-semibold text-slate-700">Telefoon:</span> {phoneNumber || "Onbekend"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-700">Vrijwillige deelname:</span> {voluntary ? "Ja" : "Nee"}</p>
                <p><span className="font-semibold text-slate-700">Huidige functie:</span> {evc?.currentRole || "Onbekend"}</p>
                <p>
                  <span className="font-semibold text-slate-700">Laatste login:</span> {lastLoginLabel}
                  {lastLoginRelative ? ` (${lastLoginRelative})` : ""}
                </p>
              </div>
            </div>
          </section>
        );
      case "candidate-intake":
        return (
          <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
            <header>
              <h3 className="text-lg font-semibold text-slate-900">Intake</h3>
              <p className="text-sm text-slate-500">Voorlopige antwoorden uit het intakeformulier.</p>
            </header>
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-400">
              Nog geen intakegegevens beschikbaar.
            </div>
          </section>
        );
      case "candidate-loopbaandoel":
        return (
          <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
            <header>
              <h3 className="text-lg font-semibold text-slate-900">Loopbaandoel</h3>
              <p className="text-sm text-slate-500">Ingevulde loopbaandoelen uit het kandidatenportaal.</p>
            </header>
            {profileData?.careerGoal ? (
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-700">{profileData.careerGoal.title || "Loopbaandoel"}</p>
                <p className="mt-2 whitespace-pre-line text-sm">{profileData.careerGoal.summary || profileData.careerGoal.description || "Geen beschrijving"}</p>
                {careerGoalUpdatedAbsolute ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {`Bijgewerkt ${careerGoalUpdatedAbsolute}`}
                    {careerGoalUpdatedRelative ? ` (${careerGoalUpdatedRelative.toLowerCase()})` : ""}
                  </p>
                ) : null}
              </article>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-400">
                Nog geen loopbaandoel ingevuld.
              </div>
            )}
          </section>
        );
      case "candidate-vragenlijst":
        return (
          <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
            <header>
              <h3 className="text-lg font-semibold text-slate-900">Vragenlijsten</h3>
              <p className="text-sm text-slate-500">Ingevulde antwoorden uit het kandidatenportaal.</p>
            </header>
            {questionnaireHasContent ? (
              <div className="space-y-4">
                {questionnaireSectionEntries.map((section) => (
                  <article
                    key={section.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                  >
                    <p className="font-semibold text-slate-700">{section.title}</p>
                    {section.response ? (
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{section.response}</p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-400">Nog geen antwoord.</p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-400">
                Nog geen vragenlijst ingevuld.
              </div>
            )}
            {questionnaireUpdatedAbsolute ? (
              <p className="text-xs text-slate-500">
                {`Bijgewerkt ${questionnaireUpdatedAbsolute}`}
                {questionnaireUpdatedRelative ? ` (${questionnaireUpdatedRelative.toLowerCase()})` : ""}
              </p>
            ) : null}
          </section>
        );
      case "candidate-contact":
        return (
          <section className="space-y-6 rounded-3xl bg-white p-6 shadow-card">
            <header className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">Contact</h3>
              <p className="text-sm text-slate-500">Contactgegevens en direct chatten met de kandidaat.</p>
            </header>
            <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
              <aside className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Gegevens</p>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> {customer.email || "Geen e-mailadres"}</li>
                  <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {phoneNumber || "Geen telefoonnummer"}</li>
                  <li className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" /> Contactpersoon: {evc?.contactPerson || "Onbekend"}</li>
                </ul>
              </aside>
              <div className="space-y-4">
                {chatError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {chatError.message || "Kon chat niet laden."}
                  </div>
                ) : null}
                {chatLoading ? (
                  <LoadingSpinner label="Chat laden" />
                ) : (
                  <>
                    <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                      {formattedChatMessages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center text-sm text-slate-400">
                          Nog geen berichten. Start hieronder het gesprek.
                        </div>
                      ) : (
                        formattedChatMessages.map((message) => (
                          <article
                            key={message.id}
                            className={`flex gap-4 rounded-2xl border px-4 py-4 shadow-sm ${
                              message.isOwn
                                ? "border-evc-blue-100 bg-evc-blue-50/60"
                                : message.isUnreadForCoach
                                ? "border-amber-200 bg-amber-50"
                                : "border-slate-100 bg-slate-50"
                            }`}
                          >
                            <div className={`${
                              message.isOwn ? "bg-evc-blue-600 text-white" : "bg-slate-200 text-slate-700"
                            } flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold`}>
                              {message.senderInitial}
                            </div>
                            <div className="flex-1 space-y-2">
                              <header className="flex flex-wrap items-baseline justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{message.senderName}</p>
                                  {message.messageTitle ? (
                                    <p className="text-base font-semibold text-slate-900">{message.messageTitle}</p>
                                  ) : null}
                                </div>
                                <time className="text-xs uppercase tracking-[0.2em] text-slate-400">{message.timestampLabel}</time>
                              </header>
                              {message.messageText ? (
                                <p className="whitespace-pre-line text-sm text-slate-700">{message.messageText}</p>
                              ) : null}
                              {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                                <ul className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {message.attachments.map((att, idx) => (
                                    <li key={`${message.id}-att-${idx}`}>
                                      <a
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-evc-blue-700 shadow-sm hover:text-evc-blue-600"
                                      >
                                        <span aria-hidden>📎</span>
                                        <span className="truncate">{att.name || "bijlage"}</span>
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              ) : message.fileUrl ? (
                                <a
                                  href={message.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-sm font-medium text-evc-blue-700 hover:text-evc-blue-600"
                                >
                                  <span aria-hidden>📎</span>
                                  Download {message.fileName || "bijlage"}
                                </a>
                              ) : null}
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                    <form onSubmit={handleSendChat} className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4">
                      <div className="grid gap-2">
                        <label htmlFor="coach-contact-chat-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Onderwerp</label>
                        <input
                          id="coach-contact-chat-title"
                          type="text"
                          value={chatTitle}
                          onChange={(e) => setChatTitle(e.target.value)}
                          placeholder="Bijvoorbeeld: Update beoordeling"
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-inner focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="coach-contact-chat-body" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bericht</label>
                        <textarea
                          id="coach-contact-chat-body"
                          rows={4}
                          value={chatBody}
                          onChange={(e) => setChatBody(e.target.value)}
                          placeholder="Schrijf je bericht"
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-evc-blue-400 focus:outline-none focus:ring-2 focus:ring-evc-blue-100"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-evc-blue-300 hover:text-evc-blue-600">
                          <span aria-hidden>📎</span>
                          <span>Voeg bijlage toe</span>
                          <input type="file" multiple className="hidden" onChange={handleChatFileChange} />
                        </label>
                        {Array.isArray(chatFiles) && chatFiles.length > 0 ? (
                          <span className="text-sm text-slate-500">
                            Geselecteerd: {chatFiles.length === 1 ? chatFiles[0].name : `${chatFiles.length} bestanden`}
                          </span>
                        ) : null}
                        <div className="flex-1" />
                        <button
                          type="submit"
                          disabled={chatSending}
                          className="inline-flex items-center gap-2 rounded-full bg-evc-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-evc-blue-500 disabled:cursor-not-allowed disabled:bg-evc-blue-300"
                        >
                          {chatSending ? "Versturen…" : "Verstuur bericht"}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  const renderInstrumentView = (view) => {
    switch (view) {
      case "instrument-portfolio":
        return (
          <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Portfolio</h3>
                <p className="text-sm text-slate-500">Uploads en bewijsstukken per competentie, inclusief gekoppelde items uit het profiel.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-1 text-xs font-semibold text-slate-600">
                Totaal {totalUploads} bestand{totalUploads === 1 ? "" : "en"}
              </div>
            </header>
            {/* Overige documenten (onbekoppeld) */}
            {uploadsByCompetency["__unassigned__"] && uploadsByCompetency["__unassigned__"].length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Overige documenten</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {uploadsByCompetency["__unassigned__"].map((upload) => {
                    const key = upload.id || upload.storagePath || upload.fileName || upload.name;
                    return (
                      <li key={key} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                        <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900">{upload.displayName || upload.name || upload.fileName || "Bestand"}</p>
                        </div>
                        <div className="ml-auto">
                          <button
                            type="button"
                            onClick={async () => {
                              const key = upload.id || upload.storagePath || upload.fileName || upload.name;
                              if (key) setDownloadInProgress(key);
                              try {
                                const url = await resolveUploadDownloadUrl(upload);
                                if (url) window.open(url, "_blank", "noopener");
                              } finally {
                                setDownloadInProgress(null);
                              }
                            }}
                            className="whitespace-nowrap rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50"
                          >
                            Download
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {competencies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-400">
                Nog geen competenties beschikbaar.
              </div>
            ) : (
              <div className="space-y-4">
                {competencies.map((competency) => {
                  const uploads = uploadsByCompetency[competency.id] || [];
                  const titleParts = [];
                  if (competency.code) titleParts.push(competency.code);
                  if (competency.title) titleParts.push(competency.title);
                  return (
                    <article key={competency.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <header className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">
                          {titleParts.length > 0 ? titleParts.join(" • ") : competency.title || competency.code || "Competentie"}
                        </p>
                        <span className="rounded-full bg-white px-2 py-1 text-[0.65rem] font-semibold text-slate-600">
                          {uploads.length} bewijsstuk{uploads.length === 1 ? "" : "ken"}
                        </span>
                      </header>
                      {(linkedByCompetency[competency.id] || []).length > 0 ? (
                        <div className="mt-3">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-slate-500">Gekoppeld uit profiel</p>
                          <ul className="mt-2 space-y-2 text-sm text-slate-700">
                            {linkedByCompetency[competency.id].map((entry) => (
                              <li key={`${entry.__section}-${entry.id}`} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-slate-900">{entry.title || entry.role || entry.organisation || "Profielitem"}</p>
                                  {entry.__section === "certificate" && entry.filePath ? (
                                    <a href={entry.filePath} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:text-brand-500">Bekijk</a>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {uploads.length === 0 ? (
                        <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
                          Nog geen bewijsstukken geüpload.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {uploads.map((upload) => {
                            const key = upload.id || upload.storagePath || upload.fileName || upload.name;
                            const uploadedAtLabel = upload.uploadedAt ? formatDateTime(upload.uploadedAt) : null;
                            const isBusy = downloadInProgress === key;
                            return (
                              <li key={key} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                                <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-slate-900">{upload.displayName || upload.name || upload.fileName || "Bestand"}</p>
                                  {uploadedAtLabel ? (
                                    <p className="mt-0.5 text-xs text-slate-500">Geüpload op {uploadedAtLabel}</p>
                                  ) : null}
                                </div>
                                <div className="ml-auto">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const downloadKey = key;
                                      if (downloadKey) setDownloadInProgress(downloadKey);
                                      try {
                                        const url = await resolveUploadDownloadUrl(upload);
                                        if (url) window.open(url, "_blank", "noopener");
                                      } finally {
                                        setDownloadInProgress(null);
                                      }
                                    }}
                                    disabled={isBusy}
                                    className="whitespace-nowrap rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                                  >
                                    {isBusy ? "Bezig..." : "Download"}
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      case "instrument-werkplek":
        return (
          <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
            <header>
              <h3 className="text-lg font-semibold text-slate-900">Werkplekbezoek</h3>
              <p className="text-sm text-slate-500">Plan of verslag van het werkplekbezoek.</p>
            </header>
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-400">
              Nog geen werkplekbezoek geregistreerd.
            </div>
          </section>
        );
      case "instrument-cbi":
        return (
          <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
            <header>
              <h3 className="text-lg font-semibold text-slate-900">Criteriumgericht interview</h3>
              <p className="text-sm text-slate-500">Voorbereiding en verslaglegging.</p>
            </header>
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-400">
              Nog geen interview gepland of vastgelegd.
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  const renderKwalificatiedossier = () => (
    <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
      <header>
        <h3 className="text-lg font-semibold text-slate-900">Kwalificatiedossier</h3>
        <p className="text-sm text-slate-500">Alle kerntaken en competenties binnen dit traject.</p>
      </header>
      {competencies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-400">
          Nog geen competenties beschikbaar.
        </div>
      ) : (
        <div className="space-y-3">
          {competencies.map((competency) => {
            const isOpen = Boolean(expandedCompetencies[competency.id]);
            const titleParts = [];
            if (competency.code) titleParts.push(competency.code);
            if (competency.title) titleParts.push(competency.title);
            const uploads = (progressData?.uploadsByCompetency || {})[competency.id] || [];
            return (
              <article key={competency.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCompetencies((prev) => ({ ...prev, [competency.id]: !prev[competency.id] }))
                  }
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{titleParts.length > 0 ? titleParts.join(" • ") : competency.title || competency.code || "Competentie"}</p>
                    {competency.description ? (
                      <p className="text-xs text-slate-500">{competency.description}</p>
                    ) : null}
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                <div
                  className={clsx(
                    "grid gap-4 border-t border-slate-200 px-5 transition-[max-height] duration-300 ease-in-out",
                    isOpen
                      ? "max-h-[9999px] overflow-visible py-4"
                      : "max-h-0 overflow-hidden"
                  )}
                >
                  {competency.desiredOutcome ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Omschrijving</p>
                      <p className="mt-2 text-sm text-slate-600">{competency.desiredOutcome}</p>
                    </div>
                  ) : null}
                  {competency.behavioralComponents?.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Prestatie-indicatoren</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {competency.behavioralComponents.map((item, index) => (
                          <li key={`${competency.id}-behavioral-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {competency.subjectKnowledge?.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Vakkennis en vaardigheden</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {competency.subjectKnowledge.map((item, index) => (
                          <li key={`${competency.id}-knowledge-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
  const [downloadInProgress, setDownloadInProgress] = useState(null);

  const renderNotes = () => (
    <section className="space-y-5 rounded-3xl bg-white p-6 shadow-card">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Aantekeningen</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <NotebookPen className="h-5 w-5 text-brand-600" /> Persoonlijke notities
          </h3>
          <p className="text-sm text-slate-500">Alleen zichtbaar voor jou als begeleider.</p>
        </div>
        <div className="text-xs text-slate-500">
          {noteRecord?.lastEdited instanceof Date
            ? `Laatst bewerkt ${formatDateTime(noteRecord.lastEdited)}`
            : noteRecord?.timestamp instanceof Date
            ? `Laatst bewerkt ${formatDateTime(noteRecord.timestamp)}`
            : "Nog niet opgeslagen"}
        </div>
      </header>

      {noteLoading ? (
        <LoadingSpinner label="Notitie laden" />
      ) : (
        <>
          <textarea
            value={noteDraft}
            onChange={(event) => {
              setNoteDraft(event.target.value);
              setNoteStatus(null);
            }}
            rows={12}
            placeholder="Schrijf je observaties en afspraken."
            className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs">
              {noteStatus?.type === "error" ? (
                <span className="text-rose-600">{noteStatus.message}</span>
              ) : noteStatus?.type === "success" ? (
                <span className="text-emerald-600">{noteStatus.message}</span>
              ) : noteStatus?.type === "info" ? (
                <span className="text-slate-500">{noteStatus.message}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={noteSaving}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {noteSaving ? "Opslaan..." : "Bewaar notitie"}
            </button>
          </div>
        </>
      )}
    </section>
  );

  const renderContent = () => {
    if (activeSection === "overzicht") return renderOverview();
    if (activeSection.startsWith("candidate-")) return renderCandidateView(activeSection);
    if (activeSection.startsWith("instrument-")) return renderInstrumentView(activeSection);
    if (activeSection === "kwalificatiedossier") return renderKwalificatiedossier();
    if (activeSection === "aantekeningen") return renderNotes();
    return null;
  };

  const isLoadingData = profileState.loading || progressState.loading;
  const hasError = profileState.error || progressState.error;

  const dropdownButtonClass = (isActive) =>
    clsx(
      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
      isActive ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-brand-200"
    );

  const navButtonClass = (isActive) =>
    clsx(
      "rounded-full px-4 py-2 text-xs font-semibold transition",
      isActive ? "bg-brand-600 text-white shadow" : "bg-white text-slate-600 hover:bg-brand-50"
    );

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar kandidaten
      </button>

      <header className="rounded-3xl bg-white p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Trajectoverzicht</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{customer.name || "Onbekende kandidaat"}</h1>
            <p className="text-sm text-slate-500">{progressData?.trajectName || customer.trajectName || customer.trajectTitle || "Traject onbekend"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
              <CalendarClock className="h-3.5 w-3.5 text-slate-400" /> Laatste login {lastLoginLabel}
              {lastLoginRelative ? ` (${lastLoginRelative})` : ""}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" /> Kwalificatie: {qualificationSummary}
            </span>
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-2 rounded-3xl bg-white p-3 shadow-card">
        <button
          type="button"
          onClick={() => setActiveSection("overzicht")}
          className={navButtonClass(activeSection === "overzicht")}
        >
          Overzicht
        </button>

        <div
          className="relative"
          onMouseEnter={() => handleDropdownEnter("candidate")}
          onMouseLeave={handleDropdownLeave}
        >
          <button
            type="button"
            onClick={() => setActiveSection("candidate-profile")}
            className={dropdownButtonClass(activeSection.startsWith("candidate-"))}
          >
            Kandidaat <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === "candidate" ? (
            <div
              className="absolute left-0 z-20 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
              onMouseEnter={() => handleDropdownEnter("candidate")}
              onMouseLeave={handleDropdownLeave}
            >
              {[
                { key: "candidate-profile", label: "Profiel" },
                { key: "candidate-intake", label: "Intake" },
                { key: "candidate-loopbaandoel", label: "Loopbaandoel" },
                { key: "candidate-vragenlijst", label: "Vragenlijst" },
                { key: "candidate-contact", label: "Contact" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setActiveSection(option.key);
                    setOpenDropdown(null);
                  }}
                  className={clsx(
                    "w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-brand-50",
                    activeSection === option.key ? "bg-brand-50 font-semibold text-brand-700" : null
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="relative"
          onMouseEnter={() => handleDropdownEnter("instrumenten")}
          onMouseLeave={handleDropdownLeave}
        >
          <button
            type="button"
            onClick={() => setActiveSection("instrument-portfolio")}
            className={dropdownButtonClass(activeSection.startsWith("instrument-"))}
          >
            Instrumenten <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === "instrumenten" ? (
            <div
              className="absolute left-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
              onMouseEnter={() => handleDropdownEnter("instrumenten")}
              onMouseLeave={handleDropdownLeave}
            >
              {[
                { key: "instrument-portfolio", label: "Portfolio" },
                { key: "instrument-werkplek", label: "Werkplekbezoek" },
                { key: "instrument-cbi", label: "Criteriumgericht interview" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setActiveSection(option.key);
                    setOpenDropdown(null);
                  }}
                  className={clsx(
                    "w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-brand-50",
                    activeSection === option.key ? "bg-brand-50 font-semibold text-brand-700" : null
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setActiveSection("kwalificatiedossier")}
          className={navButtonClass(activeSection === "kwalificatiedossier")}
        >
          Kwalificatiedossier
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("aantekeningen")}
          className={navButtonClass(activeSection === "aantekeningen")}
        >
          Aantekeningen
        </button>
      </nav>

      {hasError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
          {profileState.error?.message || progressState.error?.message || "Kon gegevens niet laden."}
        </div>
      ) : null}

      {isLoadingData ? <LoadingSpinner label="Gegevens laden" /> : renderContent()}

      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
          Dit overzicht synchroniseert realtime met Firestore.
        </span>
        <button
          type="button"
          onClick={() => {
            const normalizedBase = basePath.startsWith("/") ? basePath.replace(/\/$/, "") : `/${basePath.replace(/\/$/, "")}`;
            navigate(`${normalizedBase}/customers`);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-500"
        >
          Terug naar overzicht
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </footer>
    </div>
  );
};

export default CustomerTrajectOverview;
