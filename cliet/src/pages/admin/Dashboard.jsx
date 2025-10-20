import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Search } from "lucide-react";
import { signInWithCustomToken } from "firebase/auth";
import { subscribeAssignments, subscribeTrajects, subscribeUsers } from "../../lib/firestoreAdmin";
import { post } from "../../lib/api";
import { auth } from "../../firebase";
import {
  getTrajectStatusLabel,
  getTrajectStatusMeta,
  normalizeTrajectStatus,
  TRAJECT_STATUS,
} from "../../lib/trajectStatus";

const DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

const normalizeRole = (role) => (typeof role === "string" ? role.toLowerCase().trim() : "");

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch (_) {
      return null;
    }
  }
  const candidate = new Date(value);
  return Number.isNaN(candidate?.getTime()) ? null : candidate;
};

const daysBetween = (start) => {
  if (!start) return null;
  const startDate = toDate(start);
  if (!startDate) return null;
  const now = new Date();
  const diff = now.getTime() - startDate.getTime();
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);

  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState(null);

  const [trajects, setTrajects] = useState([]);
  const [trajectsLoading, setTrajectsLoading] = useState(true);
  const [trajectsError, setTrajectsError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCoach, setSelectedCoach] = useState("all");
  const [selectedTraject, setSelectedTraject] = useState("all");

  const [impersonationTarget, setImpersonationTarget] = useState(null);
  const [impersonationError, setImpersonationError] = useState(null);

  useEffect(() => {
    setUsersLoading(true);
    const unsubscribe = subscribeUsers(({ data, error }) => {
      if (error) {
        setUsersError(error);
        setUsers([]);
        setUsersLoading(false);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
      setUsersError(null);
      setUsersLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    setAssignmentsLoading(true);
    const unsubscribe = subscribeAssignments(({ data, error }) => {
      if (error) {
        setAssignmentsError(error);
        setAssignments([]);
        setAssignmentsLoading(false);
        return;
      }
      setAssignments(Array.isArray(data) ? data : []);
      setAssignmentsError(null);
      setAssignmentsLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    setTrajectsLoading(true);
    const unsubscribe = subscribeTrajects(({ data, error }) => {
      if (error) {
        setTrajectsError(error);
        setTrajects([]);
        setTrajectsLoading(false);
        return;
      }
      setTrajects(Array.isArray(data) ? data : []);
      setTrajectsError(null);
      setTrajectsLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const userMap = useMemo(() => {
    return users.reduce((acc, user) => {
      acc.set(user.id, user);
      return acc;
    }, new Map());
  }, [users]);

  const customers = useMemo(
    () =>
      users.filter((user) => {
        const role = normalizeRole(user.role);
        return role === "customer" || role === "user";
      }),
    [users]
  );

  const coaches = useMemo(
    () =>
      users
        .filter((user) => normalizeRole(user.role) === "coach")
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [users]
  );

  const coachOptions = useMemo(
    () => [
      { value: "all", label: "Alle begeleiders" },
      ...coaches.map((coach) => ({ value: coach.id, label: coach.name || coach.email || "Begeleider" })),
    ],
    [coaches]
  );

  const trajectOptions = useMemo(
    () => [
      { value: "all", label: "Alle trajecten" },
      ...[...trajects]
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .map((traject) => ({ value: traject.id, label: traject.name || "Onbekend traject" })),
    ],
    [trajects]
  );

  const trajectMap = useMemo(() => {
    return trajects.reduce((acc, traject) => {
      acc.set(traject.id, traject);
      return acc;
    }, new Map());
  }, [trajects]);

  const assignmentsByCustomer = useMemo(() => {
    return assignments.reduce((acc, assignment) => {
      if (assignment.customerId) {
        acc.set(assignment.customerId, assignment);
      }
      return acc;
    }, new Map());
  }, [assignments]);

  const rows = useMemo(() => {
    return customers.map((customer) => {
      const assignment = assignmentsByCustomer.get(customer.id) || null;
      const coachId = assignment?.coachId || customer.coachId || customer.assignedCoachId || null;
      const coach = coachId ? userMap.get(coachId) || null : null;
      const rawTrajectId =
        customer.trajectId || customer.currentTrajectId || customer.traject?.id || assignment?.trajectId || null;
      const traject = rawTrajectId ? trajectMap.get(rawTrajectId) || null : null;
      const startDate = assignment?.createdAt || customer.trajectStartDate || customer.startDate || customer.createdAt;
      const startDateObj = toDate(startDate);
      const trackedDays = daysBetween(startDateObj);
      const statusSource = assignment?.status || customer.status || null;
      const statusValue = normalizeTrajectStatus(statusSource);
      const statusLabel = getTrajectStatusLabel(statusSource);
      const lastLoginDate = toDate(customer.lastLoggedIn);
      return {
        id: customer.id,
        name: customer.name || "Naam onbekend",
        email: customer.email || "",
        coachId: coach?.id || null,
        coachName: coach?.name || coach?.email || "",
        trajectId: traject?.id || rawTrajectId || null,
        trajectName: traject?.name || customer.trajectName || "Onbekend",
        startDate: startDateObj,
        startDateLabel: startDateObj ? DATE_FORMATTER.format(startDateObj) : "-",
        daysActive: trackedDays,
        status: statusLabel,
        statusValue,
        lastLoggedIn: lastLoginDate,
        lastLoggedInLabel: lastLoginDate ? DATE_TIME_FORMATTER.format(lastLoginDate) : "—",
        assignment,
        coach,
        raw: customer,
      };
    });
  }, [assignmentsByCustomer, customers, trajectMap, userMap]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => {
        if (selectedCoach !== "all" && row.coachId !== selectedCoach) {
          return false;
        }
        if (selectedTraject !== "all" && row.trajectId !== selectedTraject) {
          return false;
        }
        if (!normalizedSearch) return true;
        const haystack = [
          row.name,
          row.email,
          row.coachName,
          row.trajectName,
          row.status,
          row.raw?.organisation,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const aName = (a.name || "").toLowerCase();
        const bName = (b.name || "").toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [normalizedSearch, rows, selectedCoach, selectedTraject]);

  const totalCustomers = rows.length;
  const statusSummary = rows.reduce((acc, row) => {
    if (!row.statusValue) return acc;
    acc[row.statusValue] = (acc[row.statusValue] || 0) + 1;
    return acc;
  }, {});
  const collectingCustomers = statusSummary[TRAJECT_STATUS.COLLECTING] || 0;
  const reviewPipelineCustomers =
    (statusSummary[TRAJECT_STATUS.REVIEW] || 0) +
    (statusSummary[TRAJECT_STATUS.APPROVAL] || 0);
  const withoutCoach = rows.filter((row) => !row.coachId).length;

  const loading = usersLoading || assignmentsLoading || trajectsLoading;
  const anyError = usersError || assignmentsError || trajectsError;

  const handleImpersonate = useCallback(
    async (target) => {
      if (!target) return;
      const targetId = target.firebaseUid || target.id;
      if (!targetId) return;
      const role = normalizeRole(target.role || target.raw?.role || "customer");
      if (!role || !["customer", "user", "coach"].includes(role)) return;
      setImpersonationError(null);
      setImpersonationTarget(targetId);
      try {
        const response = await post("/auth/admin/impersonate", { firebaseUid: targetId });
        const customToken = response?.targetCustomToken || response?.customerCustomToken;
        if (!customToken) {
          throw new Error("Geen impersonatie-token ontvangen");
        }
        const currentUser = localStorage.getItem("user") || null;
        let parsedUser = null;
        if (currentUser) {
          try {
            parsedUser = JSON.parse(currentUser);
          } catch (_) {
            parsedUser = null;
          }
        }
        const backup = {
          user: currentUser,
          userData: parsedUser,
          targetFirebaseUid: targetId,
          targetRole: role,
          targetName: target.name || target.email || "",
          createdAt: new Date().toISOString(),
          adminCustomToken: response.adminCustomToken || null,
        };
        localStorage.setItem("impersonationBackup", JSON.stringify(backup));
        await signInWithCustomToken(auth, customToken);
        if (response.user) {
          localStorage.setItem("user", JSON.stringify(response.user));
        }
        try {
          await post("/auth/track-login", {});
        } catch (_) {
          // Best-effort, geen blokkade
        }
        const redirectPath = response.redirectPath || (role === "coach" ? "/coach" : "/customer");
        navigate(redirectPath, { replace: true });
      } catch (error) {
        const message = error?.data?.error || error?.message || "Kon account niet openen";
        setImpersonationError(message);
      } finally {
        setImpersonationTarget(null);
      }
    },
    [navigate]
  );

  const handleEdit = useCallback(
    (customerId) => {
      if (!customerId) return;
      navigate(`/admin/users?focus=${customerId}`);
    },
    [navigate]
  );

  const handleDelete = useCallback((customerId) => {
    if (!customerId) return;
    // Placeholder until backend deletion flow exists
  alert("Verwijderen van kandidaten is nog niet beschikbaar in deze omgeving.");
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">
          Live overzicht van alle kandidaten, gekoppelde trajecten en begeleiderkoppelingen.
        </p>
      </div>

      {anyError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Kon gegevens niet laden: {anyError.message || "Onbekende fout"}
        </div>
      ) : null}

      {impersonationError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {impersonationError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<DashboardStat label="Totaal kandidaten" value={loading ? "-" : totalCustomers} helper="Realtime telling" />
        <DashboardStat
          label="Portfolios in voorbereiding"
          value={loading ? "-" : collectingCustomers}
          helper="Status: Bewijzen verzamelen"
        />
        <DashboardStat
          label="Te beoordelen"
          value={loading ? "-" : reviewPipelineCustomers}
          helper="Status: Ter beoordeling of Ter goedkeuring"
        />
	<DashboardStat label="Zonder begeleider" value={loading ? "-" : withoutCoach} helper="Geen begeleider gekoppeld" />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Zoek op kandidaat, begeleider of traject..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedTraject}
            onChange={(event) => setSelectedTraject(event.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:w-56"
          >
            {trajectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={selectedCoach}
            onChange={(event) => setSelectedCoach(event.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:w-48"
          >
            {coachOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <TableHeader>Kandidaat</TableHeader>
              <TableHeader>Traject</TableHeader>
              <TableHeader>Begeleider</TableHeader>
              <TableHeader>Startdatum</TableHeader>
              <TableHeader>Dagen actief</TableHeader>
              <TableHeader>Laatste login</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader className="text-right">Acties</TableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-600">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  Gegevens laden...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  Geen kandidaten gevonden voor de huidige filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleImpersonate(row.raw)}
                      disabled={impersonationTarget === row.id}
                      className={`font-semibold transition disabled:cursor-not-allowed ${
                        impersonationTarget === row.id
                          ? "cursor-wait text-slate-400"
                          : "text-evc-blue-600 hover:underline"
                      }`}
                    >
                      {row.name}
                    </button>
                    <div className="text-xs text-slate-500">{row.email || "Geen e-mail"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{row.trajectName}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.coach && row.coachName ? (
                      <button
                        type="button"
                        onClick={() => handleImpersonate(row.coach)}
                        disabled={impersonationTarget === row.coachId}
                        className={`font-medium transition disabled:cursor-not-allowed ${
                          impersonationTarget === row.coachId
                            ? "cursor-wait text-slate-400"
                            : "text-emerald-600 hover:underline"
                        }`}
                      >
                        {row.coachName}
                      </button>
                    ) : row.coachName ? (
                      <span className="font-medium text-slate-700">{row.coachName}</span>
                    ) : (
                      <span className="text-slate-400">Nog geen begeleider</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{row.startDateLabel}</td>
                  <td className="px-4 py-3">
                    {typeof row.daysActive === "number" ? `${row.daysActive} dagen` : "-"}
                  </td>
                  <td className="px-4 py-3">{row.lastLoggedInLabel}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.statusValue} label={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <ActionButton
                        icon={Pencil}
                        title="Bewerk kandidaat"
                        onClick={() => handleEdit(row.id)}
                      />
                      <ActionButton icon={Trash2} title="Verwijder kandidaat" onClick={() => handleDelete(row.id)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DashboardStat = ({ label, value, helper }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
};

const TableHeader = ({ children, className = "" }) => (
  <th
    scope="col"
    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`.trim()}
  >
    {children}
  </th>
);

const ActionButton = ({ icon: Icon, title, onClick, disabled, loading }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 ${
      disabled ? "cursor-not-allowed opacity-60" : ""
    }`}
  >
    {loading ? (
      <span className="text-xs font-semibold">...</span>
    ) : (
      <Icon className="h-4 w-4" aria-hidden />
    )}
  </button>
);

const StatusBadge = ({ status, label }) => {
  const meta = getTrajectStatusMeta(status);
  const resolvedLabel = label || meta.label;
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${meta.badgeClass}`}
    >
      {resolvedLabel}
    </span>
  );
};

export default AdminDashboard;
