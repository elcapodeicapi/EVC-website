import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users as UsersIcon,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  UserPlus,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  UserCog,
  Table,
} from "lucide-react";
import ModalForm from "../../components/ModalForm";
import { subscribeTrajects, subscribeUsers, subscribeAssignments } from "../../lib/firestoreAdmin";
import { getTrajectStatusBadgeClass, getTrajectStatusLabel } from "../../lib/trajectStatus";
import { post, del as apiDelete } from "../../lib/api";
import { auth } from "../../firebase";
import { signInWithCustomToken, setPersistence, browserLocalPersistence } from "firebase/auth";

const ROLE_FILTERS = [
  { value: "all", label: "Alle rollen" },
  { value: "customer", label: "Kandidaten" },
  { value: "coach", label: "Begeleiders" },
  { value: "kwaliteitscoordinator", label: "Kwaliteitscoordinatoren" },
  { value: "assessor", label: "Assessors" },
  { value: "admin", label: "Beheerders" },
];

const ROLE_LABELS = new Map([
  ["customer", "Kandidaat"],
  ["user", "Kandidaat"],
  ["coach", "Begeleider"],
  ["kwaliteitscoordinator", "Kwaliteitscoordinator"],
  ["assessor", "Assessor"],
  ["admin", "Beheerder"],
]);

const DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const DEFAULT_SORT = { key: "name", direction: "asc" };

function normalizeRole(role) {
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value?.toDate === "function") {
    try {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    } catch (_) {
      return null;
    }
  }
  if (typeof value?._seconds === "number") {
    const millis = value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6);
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";
  try {
    return DATE_FORMATTER.format(date);
  } catch (_) {
    return date.toLocaleDateString();
  }
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  try {
    return DATE_TIME_FORMATTER.format(date);
  } catch (_) {
    return date.toLocaleString();
  }
}

const SortIndicator = ({ active, direction }) => {
  if (!active) {
    return (
      <div className="flex flex-col text-slate-300">
        <ChevronUp className="h-3 w-3" />
        <ChevronDown className="-mt-1 h-3 w-3" />
      </div>
    );
  }
  return direction === "asc" ? (
    <ChevronUp className="h-4 w-4 text-brand-600" />
  ) : (
    <ChevronDown className="h-4 w-4 text-brand-600" />
  );
};

const ActionButton = ({ icon: Icon, label, onClick, tone = "slate" }) => {
  const tones = {
    slate: "border-slate-200 text-slate-500 hover:border-brand-200 hover:text-brand-600",
    brand: "border-brand-200 text-brand-600 hover:border-brand-300 hover:bg-brand-50",
    danger: "border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${tones[tone] || tones.slate}`}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
};

const RoleBadge = ({ role }) => {
  const label = ROLE_LABELS.get(role) || role || "Onbekend";
  let tone = "bg-slate-100 text-slate-600 border-slate-200";
  if (role === "coach") tone = "bg-brand-50 text-brand-700 border-brand-200";
  if (role === "kwaliteitscoordinator") tone = "bg-amber-50 text-amber-700 border-amber-200";
  if (role === "assessor") tone = "bg-sky-50 text-sky-700 border-sky-200";
  if (role === "admin") tone = "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
};

const TableHeaderButton = ({ label, sortKey, sortState, onSort, align = "left", className = "" }) => {
  const active = sortState.key === sortKey;
  const handleClick = () => onSort(sortKey);
  const alignment = align === "right" ? "text-right" : "text-left";
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${alignment} ${className}`.trim()}
    >
      <button type="button" onClick={handleClick} className="flex items-center gap-2">
        <span>{label}</span>
        <SortIndicator active={active} direction={sortState.direction} />
      </button>
    </th>
  );
};

const AdminUsers = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [usersError, setUsersError] = useState(null);
    const [usersLoading, setUsersLoading] = useState(true);

    const [trajects, setTrajects] = useState([]);
    const [trajectsLoading, setTrajectsLoading] = useState(true);
    const [trajectsError, setTrajectsError] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [sortState, setSortState] = useState(DEFAULT_SORT);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
    const [page, setPage] = useState(1);
    // Assignments state (status per candidate)
    const [assignments, setAssignments] = useState([]);
    const assignmentsByCustomer = useMemo(() => {
      const map = new Map();
      (assignments || []).forEach((a) => {
        if (a && a.customerId) map.set(a.customerId, a);
      });
      return map;
    }, [assignments]);

  const [impersonationError, setImpersonationError] = useState(null);
  const [impersonationTarget, setImpersonationTarget] = useState(null);

  const tableScrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const topSpacerRef = useRef(null);
  const syncingScrollRef = useRef(false);

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
      const unsubscribe = subscribeAssignments(({ data, error }) => {
        if (error) {
          setAssignments([]);
          return;
        }
        setAssignments(Array.isArray(data) ? data : []);
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

    const { isAdmin, currentUid } = useMemo(() => {
      try {
        const raw = localStorage.getItem("user");
        if (!raw) return { isAdmin: false, currentUid: null };
        const u = JSON.parse(raw);
        const role = (u?.role || "").toString().toLowerCase();
        const admin = role === "admin" || Boolean(u?.isAdmin) || Boolean(u?.admin === true);
        const uid = u?.uid || u?.firebaseUid || u?.id || null;
        return { isAdmin: admin, currentUid: uid };
      } catch (_) {
        return { isAdmin: false, currentUid: null };
      }
    }, []);

    const trajectNameById = useMemo(() => {
      const map = new Map();
      trajects.forEach((traject) => {
        map.set(traject.id, traject.name || "");
      });
      return map;
    }, [trajects]);

  useEffect(() => {
    const scrollContainer = tableScrollRef.current;
    const topSpacer = topSpacerRef.current;
    if (!scrollContainer || !topSpacer) return;

    const updateWidths = () => {
      // Make the top scrollbar match the table scroll width.
      topSpacer.style.width = `${scrollContainer.scrollWidth}px`;
    };

    updateWidths();
    const handleResize = () => updateWidths();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [page, pageSize, searchTerm, roleFilter, sortState, usersLoading, trajectsLoading]);

  const handleTopScroll = (event) => {
    if (syncingScrollRef.current) return;
    const top = event.currentTarget;
    const bottom = tableScrollRef.current;
    if (!bottom) return;
    syncingScrollRef.current = true;
    bottom.scrollLeft = top.scrollLeft;
    syncingScrollRef.current = false;
  };

  const handleTableScroll = (event) => {
    if (syncingScrollRef.current) return;
    const bottom = event.currentTarget;
    const top = topScrollRef.current;
    if (!top) return;
    syncingScrollRef.current = true;
    top.scrollLeft = bottom.scrollLeft;
    syncingScrollRef.current = false;
  };

    const customerCountsByCoach = useMemo(() => {
      const map = new Map();
      users.forEach((user) => {
        const role = normalizeRole(user.role);
        if (role === "customer" || role === "user") {
          const coachId = user.coachId || user.assignedCoachId || user.coachUid || user.coach?.id;
          if (coachId) {
            map.set(coachId, (map.get(coachId) || 0) + 1);
          }
        }
      });
      return map;
    }, [users]);

    const rows = useMemo(() => {
      return users.map((user) => {
        const roleKey = normalizeRole(user.role);
        const name = user.name || "Naam onbekend";
        const email = user.email || "—";
        const createdAt = toDate(user.createdAt);
        const lastLoggedIn = toDate(user.lastLoggedIn);
        const trajectId = user.trajectId || user.currentTrajectId || user.traject?.id || null;
        const trajectName = trajectId ? trajectNameById.get(trajectId) || user.trajectName || "Traject onbekend" : "—";
        const coachCount = roleKey === "coach" ? customerCountsByCoach.get(user.id) || 0 : null;
        const assignment = (roleKey === "customer" || roleKey === "user") ? assignmentsByCustomer.get(user.id) : null;

        return {
          id: user.id,
          name,
          email,
          roleKey,
          roleLabel: ROLE_LABELS.get(roleKey) || (user.role ? user.role : "Onbekend"),
          createdAt,
          createdAtLabel: formatDate(createdAt),
          lastLoggedIn,
          lastLoggedInLabel: lastLoggedIn ? formatDateTime(lastLoggedIn) : "—",
          coachCount,
          trajectName,
          assignment,
          raw: user,
        };
      });
    }, [assignmentsByCustomer, customerCountsByCoach, trajectNameById, users]);

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredRows = useMemo(() => {
      return rows.filter((row) => {
        if (roleFilter !== "all" && row.roleKey !== roleFilter) {
          return false;
        }
        if (!normalizedSearch) return true;
        const haystack = [
          row.name,
          row.email,
          row.roleLabel,
          row.trajectName,
          row.coachCount != null ? String(row.coachCount) : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }, [normalizedSearch, roleFilter, rows]);

    useEffect(() => {
      setPage(1);
    }, [normalizedSearch, roleFilter, pageSize]);

    const sortedRows = useMemo(() => {
      const dir = sortState.direction === "asc" ? 1 : -1;
      const sorted = [...filteredRows].sort((a, b) => {
        const { key } = sortState;
        const valueA = a[key];
        const valueB = b[key];

        if (key === "coachCount") {
          return ((valueA ?? -1) - (valueB ?? -1)) * dir;
        }

        if (valueA instanceof Date || valueB instanceof Date) {
          const timeA = valueA ? valueA.getTime() : 0;
          const timeB = valueB ? valueB.getTime() : 0;
          if (timeA === timeB) return 0;
          return timeA > timeB ? dir : -dir;
        }

        const stringA = (valueA ?? "").toString().toLowerCase();
        const stringB = (valueB ?? "").toString().toLowerCase();
        if (stringA === stringB) return 0;
        return stringA.localeCompare(stringB) * dir;
      });
      return sorted;
    }, [filteredRows, sortState]);

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

    useEffect(() => {
      if (page > totalPages) {
        setPage(totalPages);
      }
    }, [page, totalPages]);

    const paginatedRows = useMemo(() => {
      const start = (page - 1) * pageSize;
      return sortedRows.slice(start, start + pageSize);
    }, [page, pageSize, sortedRows]);

    const summary = useMemo(() => {
      const totals = {
        all: rows.length,
        coach: 0,
        customer: 0,
        admin: 0,
      };
      rows.forEach((row) => {
        if (row.roleKey === "coach") totals.coach += 1;
        if (row.roleKey === "admin") totals.admin += 1;
        if (row.roleKey === "customer" || row.roleKey === "user") totals.customer += 1;
      });
      return totals;
    }, [rows]);

    const handleSort = (key) => {
      setSortState((prev) => {
        if (prev.key === key) {
          return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
        }
        return { key, direction: "asc" };
      });
    };

    const handleViewProfile = (row) => {
      navigate(`/admin/users?focus=${row.id}`);
    };

    // Admin edit now navigates to a dedicated edit page instead of impersonation
    const handleEditUser = (row) => {
      if (!row?.id) return;
      navigate(`/admin/edit-user/${row.id}`);
    };

  const [deleteTarget, setDeleteTarget] = useState(null);
    const [deletePending, setDeletePending] = useState(false);
    const [deleteError, setDeleteError] = useState(null);
  const [ackAdminDelete, setAckAdminDelete] = useState(false);

    const handleDeleteUser = (row) => {
      setDeleteTarget(row);
      setDeleteError(null);
      setAckAdminDelete(false);
    };

    const confirmDelete = async () => {
      if (!deleteTarget) return;
      setDeletePending(true);
      setDeleteError(null);
      try {
        const uid = deleteTarget.id || deleteTarget.raw?.firebaseUid;
        if (!uid) throw new Error("Kan gebruikers-id niet bepalen");
        await apiDelete(`/auth/admin/users/${uid}`);
        setDeleteTarget(null);
      } catch (err) {
        setDeleteError(err?.data?.error || err?.message || "Verwijderen mislukt");
      } finally {
        setDeletePending(false);
      }
    };

    const handleCreateUser = () => {
      navigate("/admin/users/create");
    };

    const resolveRedirectPath = (role) => {
      switch (role) {
        case "coach":
          return "/coach";
        case "kwaliteitscoordinator":
          return "/kwaliteitscoordinator";
        case "assessor":
          return "/assessor";
        case "customer":
        case "user":
          return "/customer";
        default:
          return "/dashboard";
      }
    };

    const handleImpersonate = async (row, redirectOverride = null) => {
      if (!row) return;
      const targetId = row.id || row.firebaseUid;
      if (!targetId) return;
      const role = (row.roleKey || "").toLowerCase();
      // Only allow known roles to be impersonated
      if (!role || !["customer", "user", "coach", "kwaliteitscoordinator", "assessor"].includes(role)) return;

      setImpersonationError(null);
      setImpersonationTarget(targetId);
      try {
        const response = await post("/auth/admin/impersonate", { firebaseUid: targetId });
        const customToken = response?.targetCustomToken || response?.customerCustomToken;
        if (!customToken) throw new Error("Geen impersonatie-token ontvangen");

        const currentUser = localStorage.getItem("user") || null;
        let parsedUser = null;
        if (currentUser) {
          try { parsedUser = JSON.parse(currentUser); } catch (_) { parsedUser = null; }
        }

        const backup = {
          user: currentUser,
          userData: parsedUser,
          targetFirebaseUid: targetId,
          targetRole: role,
          targetName: row.name || row.email || "",
          createdAt: new Date().toISOString(),
          adminCustomToken: response?.adminCustomToken || null,
        };
        localStorage.setItem("impersonationBackup", JSON.stringify(backup));

  try { await setPersistence(auth, browserLocalPersistence); } catch (_) { /* persistence already set or unsupported */ }
  await signInWithCustomToken(auth, customToken);
        if (response?.user) {
          localStorage.setItem("user", JSON.stringify(response.user));
        }
        try { await post("/auth/track-login", {}); } catch (_) { /* best-effort */ }

        const redirectPath = redirectOverride || response?.redirectPath || resolveRedirectPath(role);
        navigate(redirectPath, { replace: true });
      } catch (err) {
        const message = err?.data?.error || err?.message || "Kon account niet openen";
        setImpersonationError(message);
      } finally {
        setImpersonationTarget(null);
      }
    };

  const isLoading = usersLoading || trajectsLoading;
  const error = usersError || trajectsError;
  const errorMessage = error ? (typeof error === "string" ? error : error.message) : null;

    return (
      <div className="space-y-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Gebruikersoverzicht</h1>
            <p className="text-sm text-slate-500">Beheer alle accounts, filter op rol en bekijk inlogactiviteit.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 sm:flex">
              <UsersIcon className="h-4 w-4" />
              <span>{summary.all} gebruikers</span>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:flex">
              <UserCog className="h-4 w-4" />
              <span>{summary.coach} begeleiders</span>
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Kon gebruikers niet laden: {errorMessage || "Onbekende fout"}
          </div>
        ) : null}

        {impersonationError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {impersonationError}
          </div>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Zoek op naam, e-mail, traject of begeleider"
                  className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="w-44 rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {ROLE_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="page-size">
                Rijen per pagina
              </label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreateUser}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
              >
                <UserPlus className="h-4 w-4" />
                Nieuwe gebruiker
              </button>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              aria-hidden="true"
              className="overflow-x-auto border-b border-slate-200 bg-slate-50"
            >
              <div ref={topSpacerRef} className="h-4" />
            </div>
            <div ref={tableScrollRef} onScroll={handleTableScroll} className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeaderButton label="Naam" sortKey="name" sortState={sortState} onSort={handleSort} />
                    <TableHeaderButton label="E-mail" sortKey="email" sortState={sortState} onSort={handleSort} />
                    <TableHeaderButton label="Rol" sortKey="roleLabel" sortState={sortState} onSort={handleSort} />
                    <TableHeaderButton label="Traject" sortKey="trajectName" sortState={sortState} onSort={handleSort} />
                    <TableHeaderButton label="Status" sortKey="status" sortState={sortState} onSort={handleSort} />
                    <TableHeaderButton label="Account aangemaakt" sortKey="createdAt" sortState={sortState} onSort={handleSort} />
                    <TableHeaderButton label="Laatste login" sortKey="lastLoggedIn" sortState={sortState} onSort={handleSort} />
                    <TableHeaderButton
                      label="Begeleiderbelasting"
                      sortKey="coachCount"
                      sortState={sortState}
                      onSort={handleSort}
                      align="right"
                    />
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Opties
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                        <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Gegevens laden...
                        </div>
                      </td>
                    </tr>
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                        Geen gebruikers gevonden voor de huidige filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="px-4 py-3 text-slate-600">{row.email}</td>
                        <td className="px-4 py-3">
                          <RoleBadge role={row.roleKey} />
                        </td>
                        <td className="px-4 py-3 text-black">
                          <div className="flex items-center gap-2">
                            <span>{row.trajectName}</span>
                            {isAdmin && (row.roleKey === "customer" || row.roleKey === "user") ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/traject-wijzigen/${row.id}`)}
                                title="EVC-traject wijzigen"
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-200 text-brand-600 transition hover:border-brand-300 hover:bg-brand-50"

                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(row.roleKey === "customer" || row.roleKey === "user") && row.assignment ? (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs  font-semibold uppercase tracking-wide ${getTrajectStatusBadgeClass(row.assignment.status)} `}>
                                {getTrajectStatusLabel(row.assignment.status)}
                              </span>
                              {isAdmin && (
                                <ActionButton icon={Pencil} label="Status bewerken" onClick={() => handleEditUser(row)} tone="brand" />
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {row.assignment?.assessorId ? (
                            <div className="mt-1 text-xs text-slate-500">
                              Toegewezen aan: {users.find((u) => u.id === row.assignment.assessorId)?.name || users.find((u) => u.id === row.assignment.assessorId)?.email || row.assignment.assessorId}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.createdAtLabel}</td>
                        <td className="px-4 py-3 text-slate-600">{row.lastLoggedInLabel}</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {row.roleKey === "coach" ? (
                            <span className="font-semibold text-slate-900">{row.coachCount}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {isAdmin && (["customer", "user", "coach", "kwaliteitscoordinator", "assessor"].includes(row.roleKey)) && (
                              <ActionButton icon={Eye} label="Open als gebruiker" onClick={() => handleImpersonate(row)} />
                            )}
                            {isAdmin && (
                              <ActionButton icon={Pencil} label="Bewerk" onClick={() => handleEditUser(row)} tone="brand" />
                            )}
                            {isAdmin && (
                              <ActionButton icon={Trash2} label="Verwijder" onClick={() => handleDeleteUser(row)} tone="danger" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <div>
              Totaal {sortedRows.length} resultaten • Pagina {page} van {totalPages}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vorige
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Volgende
              </button>
            </div>
          </div>
        </section>
        {deleteTarget ? (
          <ModalForm
            open={true}
            title="Gebruiker verwijderen"
            description={`Weet je zeker dat je ${deleteTarget.name || deleteTarget.email || "deze gebruiker"} wilt verwijderen? Dit verwijdert het account en profiel permanent.`}
            onClose={() => (!deletePending ? setDeleteTarget(null) : null)}
            footer={
              <>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deletePending}
                  className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deletePending || ((deleteTarget?.roleKey === "admin" || deleteTarget?.id === currentUid) && !ackAdminDelete)}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletePending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Verwijderen…</>) : "Verwijderen"}
                </button>
              </>
            }
          >
            {(deleteTarget?.roleKey === "admin" || deleteTarget?.id === currentUid) ? (
              <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Waarschuwing: je verwijdert een beheerder of mogelijk je eigen account. Dit kan toegang tot het systeem beïnvloeden.
                Vink de bevestiging hieronder aan om door te gaan.
              </div>
            ) : null}
            {deleteError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {deleteError}
              </div>
            ) : null}
            {(deleteTarget?.roleKey === "admin" || deleteTarget?.id === currentUid) ? (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  checked={ackAdminDelete}
                  onChange={(e) => setAckAdminDelete(e.target.checked)}
                  disabled={deletePending}
                />
                <span>Ik begrijp dat dit een beheerder of mijn eigen account kan verwijderen</span>
              </label>
            ) : null}
          </ModalForm>
        ) : null}
      </div>
    );
  };

export default AdminUsers;
