import React, { useCallback, useEffect, useMemo, useState } from "react";
// TODO Checklist:
// [x] Make desiredOutcome optional in admin traject form payloads and validation
// [x] Ensure competency accordions expand to fit tall content with scroll support
// [x] Replace customer dashboard placeholders with live traject status data
// [ ] Enable staff profiles (admin/coach/kwaliteit/assessor) to edit core details
// [x] Remove the "Rapport genereren" mock button from staff topbars
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	Outlet,
	useNavigate,
	useLocation,
} from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import BrandLogo from "../components/BrandLogo";
import Login from "./Login";
import Home from "./Home";
import AdminDashboard from "./admin/Dashboard";
import AdminAssignments from "./admin/Assignments";
import AdminTrajects from "./admin/Trajects";
import AdminProfile from "./admin/Profile";
import AdminUsers from "./admin/Users";
import AdminCreateUser from "./admin/CreateUser";
import TestCreateAccount from "./TestCreateAccount";
import CustomerDashboard from "./customer/Dashboard";
import CustomerPlanning from "./customer/Planning";
import CustomerMessages from "./customer/Messages";
import CustomerProfile from "./customer/Profile";
import CustomerCareerGoal from "./customer/CareerGoal";
import CustomerWorkplaceVisit from "./customer/WorkplaceVisit";
import CustomerCriteriumInterview from "./customer/CriteriumInterview";
import CustomerManual from "./customer/Manual";
import CustomerReady from "./customer/Klaar";
import CustomerVragenlijst from "./customer/Vragenlijst";
import CoachDashboard from "./coach/Dashboard";
import CoachCustomers from "./coach/Customers";
import CoachCustomerCompetency from "./coach/CustomerCompetency";
import CoachMessages from "./coach/Messages";
import CoachNotes from "./coach/AantekeningenOverzicht";
import CoachProfile from "./coach/Profile";
import {
	LayoutDashboard,
	Users as UsersIcon,
	FileSpreadsheet,
	FileText,
	Mail,
	MessageSquare,
	IdCard,
	Goal,
		FolderOpen,
	Briefcase,
	ClipboardCheck,
	BookOpen,
		NotebookPen,
		CheckCircle2,
		CircleHelp,
} from "lucide-react";
import { onAuthStateChanged, signOut, signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebase";
import { subscribeAdminProfile } from "../lib/firestoreAdmin";
import { subscribeCustomerContext } from "../lib/firestoreCustomer";
import {
	subscribeCoachAssignments,
	subscribeCoachCustomers,
	subscribeCoachProfile,
	subscribeCoordinatorAssignments,
	subscribeAssessorAssignments,
	subscribeAssignmentByCustomerId,
	subscribeAssignmentForCoach,
} from "../lib/firestoreCoach";

import { subscribeUnreadMessagesForCoach } from "../lib/firestoreMessages";
import { get, post } from "../lib/api";
import {
	getTrajectStatusLabel,
	isCollectingStatus,
	normalizeTrajectStatus,
	getNextTrajectStatus,
	getPreviousTrajectStatus,
	TRAJECT_STATUS,
} from "../lib/trajectStatus";
import { updateAssignmentStatus } from "../lib/assignmentWorkflow";
import ModalForm from "../components/ModalForm";
import { fetchUsersByRole, getUsersIndex } from "../lib/firestoreAdmin";
import { useResubscribingListener, withObserver } from "../hooks/useFirestoreListeners";

const ADMIN_NAV_ITEMS = [
	{ label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
	{ label: "Opdrachten", to: "/admin/assignments", icon: FileSpreadsheet },
	{ label: "Trajecten", to: "/admin/trajects", icon: FileText },
	{ label: "Gebruikers", to: "/admin/users", icon: UsersIcon },
	{ label: "Profiel", to: "/admin/profile", icon: IdCard },
  { label: "Handleiding", to: "/admin/manual", icon: BookOpen },
];

const COACH_NAV_BLUEPRINT = [
	{ label: "Dashboard", path: "", icon: LayoutDashboard, end: true },
	{ label: "Mijn kandidaten", path: "/customers", icon: UsersIcon },
	{ label: "Aantekeningen", path: "/aantekeningen", icon: NotebookPen },
	{ label: "Berichten", path: "/messages", icon: Mail },
	{ label: "Profiel", path: "/profile", icon: IdCard },
  { label: "Handleiding", path: "/manual", icon: BookOpen },
];

const buildCoachNavItems = (basePath) => {
	const sanitizedBase = basePath === "/" ? "" : basePath.replace(/\/$/, "");
	return COACH_NAV_BLUEPRINT.map((item) => ({
		...item,
		to: `${sanitizedBase}${item.path}` || "/",
	}));
};

const COACH_ROLE_LABELS = {
	coach: "Begeleider",
	kwaliteitscoordinator: "Kwaliteitscoordinator",
	assessor: "Assessor",
};

const COACH_ROLE_ROUTES = {
	coach: "/coach",
	kwaliteitscoordinator: "/kwaliteitscoordinator",
	assessor: "/assessor",
};

const BASE_CUSTOMER_NAV_ITEMS = [
	{ label: "Dashboard", to: "/customer/dashboard", icon: LayoutDashboard, end: true },
	{ label: "Mijn profiel", to: "/customer/profile", icon: IdCard },
	{ label: "Mijn loopbaandoel", to: "/customer/career-goal", icon: Goal },
	{ label: "Vragenlijst", to: "/customer/vragenlijst", icon: CircleHelp },
	{ label: "Mijn portfolio", to: "/customer/portfolio", icon: FolderOpen },
	{ label: "Werkplekbezoek", to: "/customer/workplace-visit", icon: Briefcase },
	{ label: "Criteriumgericht interview", to: "/customer/criterium-interview", icon: ClipboardCheck },
	{ label: "Contact", to: "/customer/contact", icon: MessageSquare },
	{ label: "Handleiding", to: "/customer/manual", icon: BookOpen },
];

const READY_NAV_ITEM = { label: "Klaar?", to: "/customer/klaar", icon: CheckCircle2 };

const normalizeUserRecord = (user) => {
	if (!user || typeof user !== "object") return user ?? null;
	const next = { ...user };
	if (next.uid && !next.firebaseUid) {
		next.firebaseUid = next.uid;
	} else if (next.firebaseUid && !next.uid) {
		next.uid = next.firebaseUid;
	}
	return next;
};

const AdminLayout = () => {
	const navigate = useNavigate();
	const [uid, setUid] = useState(null);
	const [profile, setProfile] = useState(null);
	const [profileError, setProfileError] = useState(null);

	const handleLogout = () => {
		localStorage.removeItem("token");
		navigate("/", { replace: true });
	};

	useEffect(() => {
		let mounted = true;
		const storedUser = localStorage.getItem("user");
		if (storedUser) {
			try {
				const parsed = JSON.parse(storedUser);
				const resolvedUid = parsed?.firebaseUid || parsed?.uid;
				if (resolvedUid && mounted) {
					setUid(resolvedUid);
				}
			} catch (_) {
				// ignore parsing issues
			}
		}
		const unsubscribeAuth = onAuthStateChanged(auth, (current) => {
			if (!mounted) return;
			if (current?.uid) {
				setUid((prev) => prev || current.uid);
			}
		});
		return () => {
			mounted = false;
			unsubscribeAuth();
		};
	}, []);

	useEffect(() => {
		if (!uid) {
			setProfile(null);
			return undefined;
		}
		const unsubscribe = subscribeAdminProfile(uid, ({ data, error }) => {
			if (error) {
				setProfileError(error);
				setProfile(null);
				return;
			}
			setProfileError(null);
			setProfile(data || null);
		});
		return () => {
			if (typeof unsubscribe === "function") unsubscribe();
		};
	}, [uid]);

	const displayName = profile?.name || profile?.email || "Beheerder";
	const displayRole = profile?.role
		? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
		: "Beheerder";
	const subtitle = profileError ? "Beheerder" : displayRole;

	return (
		<DashboardLayout
			className="bg-white"
			mainClassName="bg-white"
			sidebar={
				<Sidebar
					tone="dark"
					header={
						<div className="space-y-4 text-white">
							<BrandLogo className="w-fit" tone="dark" />
							<div className="space-y-1">
								<p className="text-xs uppercase tracking-[0.35em] text-white/60">Beheerder</p>
								<h1 className="text-xl font-semibold text-white">EVC Control</h1>
							</div>
						</div>
					}
					navItems={ADMIN_NAV_ITEMS}
					footer={
						<button
							type="button"
							onClick={handleLogout}
							className="flex w-full items-center justify-center rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
						>
							Afmelden
						</button>
					}
				/>
			}
			topbar={
				<Topbar
						title="Administratie-overzicht"
					tone="brand"
						user={{ name: displayName, subtitle, role: "Beheerder" }}
					logoTo="/admin"
					rightSlot={
						<div className="hidden items-center gap-3 md:flex">
							<button
								type="button"
								onClick={handleLogout}
								className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-evc-blue-600 shadow-lg transition hover:bg-white/90"
							>
								Afmelden
							</button>
						</div>
					}
				/>
			}
		>
			<Outlet />
		</DashboardLayout>
	);
};

const CoachLayout = ({ roleOverride, basePath: basePathProp } = {}) => {
	const navigate = useNavigate();
	const [sqlUser, setSqlUser] = useState(() => {
		try {
			const raw = localStorage.getItem("user") || "null";
			return normalizeUserRecord(JSON.parse(raw));
		} catch (_) {
			return null;
		}
	});
	const [impersonationBackup, setImpersonationBackup] = useState(() => {
		try {
			const raw = localStorage.getItem("impersonationBackup");
			return raw ? JSON.parse(raw) : null;
		} catch (_) {
			return null;
		}
	});
	const [loadingUser, setLoadingUser] = useState(!sqlUser);
	const [userError, setUserError] = useState(null);

	useEffect(() => {
		let active = true;
		const loadUser = async () => {
			setLoadingUser(true);
			try {
				const data = await get("/auth/me");
				if (!active) return;
				setSqlUser((previous) => {
					const merged = normalizeUserRecord({ ...(previous || {}), ...(data || {}) });
					try {
						localStorage.setItem("user", JSON.stringify(merged));
					} catch (_) {
						// ignore persistent storage errors
					}
					return merged;
				});
				setUserError(null);
			} catch (error) {
				if (!active) return;
				setUserError(error);
			} finally {
				if (active) {
					setLoadingUser(false);
				}
			}
		};

		loadUser();
		return () => {
			active = false;
		};
	}, []);

	const coachUid = sqlUser?.firebaseUid || sqlUser?.uid || null;

	const [coachDoc, setCoachDoc] = useState(null);
	const [coachProfileError, setCoachProfileError] = useState(null);

			useResubscribingListener(
					(helpers) => {
				if (!coachUid) {
					setCoachDoc(null);
					setCoachProfileError(null);
					return () => {};
				}
				return subscribeCoachProfile(
					coachUid,
							withObserver(
						(data) => {
							setCoachProfileError(null);
							setCoachDoc(data || null);
						},
						(error) => {
									setCoachProfileError(error);
								},
								helpers
					)
				);
			},
					[coachUid],
			{ name: "coach:profile" }
		);

	const [customersList, setCustomersList] = useState([]);
	const [customersError, setCustomersError] = useState(null);

			useResubscribingListener(
					(helpers) => {
				if (!coachUid) {
					setCustomersList([]);
					setCustomersError(null);
					return () => {};
				}
				return subscribeCoachCustomers(
					coachUid,
							withObserver(
						(data) => {
							setCustomersError(null);
							setCustomersList(Array.isArray(data) ? data : []);
						},
						(error) => {
									setCustomersError(error);
								},
								helpers
					)
				);
			},
					[coachUid],
			{ name: "coach:customers" }
		);

	// Resolve role and navigation early, used by downstream effects
	const resolvedRole = useMemo(
		() => (roleOverride || coachDoc?.role || sqlUser?.role || "coach").toLowerCase(),
		[roleOverride, coachDoc, sqlUser]
	);
	const roleLabel = COACH_ROLE_LABELS[resolvedRole] || "Begeleider";
	const explicitBasePath = basePathProp || COACH_ROLE_ROUTES[resolvedRole] || "/coach";
	const normalizedBasePath = explicitBasePath.startsWith("/")
		? explicitBasePath.replace(/\/$/, "") || "/"
		: `/${explicitBasePath.replace(/\/$/, "")}`;
	const coachNavItems = useMemo(() => buildCoachNavItems(normalizedBasePath || "/"), [normalizedBasePath]);

	const [assignments, setAssignments] = useState([]);
	const [assignmentsError, setAssignmentsError] = useState(null);

	// Derived customers for kwaliteitscoordinator/assessor based on assignments
	const [assignedCustomers, setAssignedCustomers] = useState([]);
	const [assignedCustomersError, setAssignedCustomersError] = useState(null);

			useResubscribingListener(
					(helpers) => {
				if (!coachUid) {
					setAssignments([]);
					setAssignmentsError(null);
					return () => {};
				}
						const observer = withObserver(
					(data) => {
						setAssignmentsError(null);
						setAssignments(Array.isArray(data) ? data : []);
					},
					(error) => {
								setAssignmentsError(error);
							},
							helpers
				);
				if (resolvedRole === "kwaliteitscoordinator") {
					return subscribeCoordinatorAssignments(coachUid, observer);
				}
				if (resolvedRole === "assessor") {
					return subscribeAssessorAssignments(coachUid, observer);
				}
				return subscribeCoachAssignments(coachUid, observer);
			},
					[coachUid, resolvedRole],
			{ name: "coach:assignments" }
		);

	// Build customers list for non-coach roles from assignments
	useEffect(() => {
		if (resolvedRole === "coach") {
			setAssignedCustomers([]);
			setAssignedCustomersError(null);
			return;
		}
		const ids = Array.from(new Set(assignments.map((a) => a.customerId).filter(Boolean)));
		if (ids.length === 0) {
			setAssignedCustomers([]);
			setAssignedCustomersError(null);
			return;
		}
		let active = true;
		(async () => {
			try {
				const index = await getUsersIndex();
				if (!active) return;
				const list = ids
					.map((id) => index.get(id))
					.filter(Boolean)
					.map((user) => ({
						id: user.id,
						name: user.name || "",
						email: user.email || "",
						photoURL: user.photoURL || user.photoUrl || null,
						lastActivity: user.lastActivity || null,
						lastLoggedIn: user.lastLoggedIn || null,
						// Ensure dossier/instrument views can resolve the traject
						trajectId: user.trajectId || null,
						trajectName: user.trajectName || user.trajectTitle || "",
						trajectTitle: user.trajectTitle || user.trajectName || "",
						trajectCode: user.trajectCode || "",
					}));
				setAssignedCustomers(list);
				setAssignedCustomersError(null);
			} catch (error) {
				if (!active) return;
				setAssignedCustomers([]);
				setAssignedCustomersError(error);
			}
		})();
		return () => {
			active = false;
		};
	}, [assignments, resolvedRole]);

	const [unreadMessages, setUnreadMessages] = useState([]);
	const [unreadMessagesError, setUnreadMessagesError] = useState(null);

			useResubscribingListener(
					(helpers) => {
				if (!coachUid) {
					setUnreadMessages([]);
					setUnreadMessagesError(null);
					return () => {};
				}
				return subscribeUnreadMessagesForCoach(
					coachUid,
							withObserver(
						(data) => {
							setUnreadMessages(Array.isArray(data) ? data : []);
							setUnreadMessagesError(null);
						},
						(error) => {
									setUnreadMessagesError(error);
								},
								helpers
					)
				);
			},
					[coachUid],
			{ name: "coach:unread" }
		);


	const customerOptions = useMemo(() => {
			const base = [{ value: "all", label: "Alle kandidaten" }];
			const sourceList = resolvedRole === "coach" ? customersList : assignedCustomers;
			if (sourceList.length > 0) {
				return [
					...base,
					...sourceList.map((customer) => ({
						value: customer.id,
						label: customer.name || customer.email || "Onbekende kandidaat",
					})),
				];
			}
			return base;
		}, [assignedCustomers, customersList, resolvedRole]);

	const [selectedCustomerId, setSelectedCustomerId] = useState("all");
	const [statusUpdating, setStatusUpdating] = useState(false);
	const [statusUpdateError, setStatusUpdateError] = useState(null);
	// Assessor selection modal state (for kwaliteitscoordinator advancing to ASSESSMENT)
	const [assessorModalOpen, setAssessorModalOpen] = useState(false);
	const [assessorsList, setAssessorsList] = useState([]);
	const [assessorLoading, setAssessorLoading] = useState(false);
	const [assessorError, setAssessorError] = useState(null);
	const [selectedAssessorId, setSelectedAssessorId] = useState("");
	const isImpersonating = Boolean(impersonationBackup);
	const impersonatingAdminLabel = useMemo(() => {
		if (!impersonationBackup?.userData) return null;
		const { name, email } = impersonationBackup.userData;
		return name || email || null;
	}, [impersonationBackup]);

	useEffect(() => {
		if (!customerOptions.some((option) => option.value === selectedCustomerId)) {
			setSelectedCustomerId(customerOptions[0]?.value || "all");
		}
	}, [customerOptions, selectedCustomerId]);

	useEffect(() => {
		setStatusUpdateError(null);
	}, [selectedCustomerId]);

		const selectedCustomer = useMemo(
			() => {
				if (selectedCustomerId === "all") return null;
				const sourceList = resolvedRole === "coach" ? customersList : assignedCustomers;
				return sourceList.find((customer) => customer.id === selectedCustomerId) || null;
			},
			[assignedCustomers, customersList, resolvedRole, selectedCustomerId]
		);

		const [focusedAssignment, setFocusedAssignment] = useState(null);

		// Directly subscribe to the assignment for the selected candidate (by customerId)
		useResubscribingListener(
			(helpers) => {
				if (!selectedCustomerId || selectedCustomerId === "all") {
					setFocusedAssignment(null);
					return () => {};
				}
				const normalizedRole = (resolvedRole || "coach").toLowerCase();
				if (normalizedRole === "coach" && coachUid) {
					return subscribeAssignmentForCoach(
						selectedCustomerId,
						coachUid,
						({ data, error }) => {
							if (error) {
								helpers?.onError?.(error);
								return;
							}
							setFocusedAssignment(data || null);
						}
					);
				}
				return subscribeAssignmentByCustomerId(
					selectedCustomerId,
					({ data, error }) => {
						if (error) {
							helpers?.onError?.(error);
							return;
						}
						setFocusedAssignment(data || null);
					}
				);
			},
			[selectedCustomerId],
			{ name: "coach:assignmentByCustomer" }
		);

		const selectedAssignment = useMemo(() => {
			if (selectedCustomerId === "all") return null;
			// Prefer focused assignment subscription for freshest status
			if (focusedAssignment && (focusedAssignment.customerId === selectedCustomerId || focusedAssignment.id === selectedCustomerId)) {
				return focusedAssignment;
			}
			return (
				assignments.find(
					(assignment) => assignment.customerId === selectedCustomerId || assignment.id === selectedCustomerId
				) || null
			);
		}, [assignments, focusedAssignment, selectedCustomerId]);

		// Debug selection flow (toggle with VITE_DEBUG_STATUS=true)
		useEffect(() => {
			if (import.meta?.env?.VITE_DEBUG_STATUS === "true") {
				// eslint-disable-next-line no-console
				console.log("[status] coachUid=", coachUid, "selectedCustomerId=", selectedCustomerId, "assignments=", assignments?.length || 0);
				if (selectedAssignment) {
					// eslint-disable-next-line no-console
					console.log("[status] selectedAssignment:", {
						id: selectedAssignment.id,
						customerId: selectedAssignment.customerId,
						status: selectedAssignment.status,
						updatedAt: selectedAssignment.statusUpdatedAt,
					});
				} else {
					// eslint-disable-next-line no-console
					console.log("[status] no selectedAssignment");
				}
			}
		}, [assignments, coachUid, selectedAssignment, selectedCustomerId]);

		const subtitle = useMemo(() => {
		const parts = [];
		if (isImpersonating) {
			parts.push(`Meespelen door ${impersonatingAdminLabel || "Beheerder"}`);
		}
		if (selectedCustomer) {
			parts.push(`Focus: ${selectedCustomer.name || selectedCustomer.email || "Kandidaat"}`);
			} else if ((resolvedRole === "coach" ? customersList.length : assignedCustomers.length) === 0) {
			parts.push("Geen kandidaten gekoppeld");
		} else {
				const count = resolvedRole === "coach" ? customersList.length : assignedCustomers.length;
				parts.push(`${count} kandidaten gekoppeld`);
		}
		return parts.join(" • ");
		}, [assignedCustomers.length, customersList.length, impersonatingAdminLabel, isImpersonating, resolvedRole, selectedCustomer]);

	const unreadMessagesByThread = useMemo(() => {
		const map = {};
		unreadMessages.forEach((message) => {
			if (!message?.threadId) return;
			if (!map[message.threadId]) map[message.threadId] = [];
			map[message.threadId].push(message);
		});
		return map;
	}, [unreadMessages]);

	const unreadMessageSummary = useMemo(() => {
		const uniqueSenders = new Set();
		unreadMessages.forEach((message) => {
			if (message?.senderId) uniqueSenders.add(message.senderId);
		});
		return {
			total: unreadMessages.length,
			uniqueSenders: uniqueSenders.size,
			error: unreadMessagesError,
		};
	}, [unreadMessages, unreadMessagesError]);


	const performStatusUpdate = useCallback(
		async ({ customerId, status, note, assessorId } = {}) => {
			if (statusUpdating) return false;
			const targetCustomerId = customerId || selectedCustomerId;
			if (!targetCustomerId || targetCustomerId === "all") {
				setStatusUpdateError("Selecteer een kandidaat om de status te wijzigen.");
				return false;
			}
			const normalizedStatus = normalizeTrajectStatus(status);
			if (!normalizedStatus) {
				setStatusUpdateError("Ongeldige statusstap.");
				return false;
			}
			setStatusUpdating(true);
			setStatusUpdateError(null);
			try {
				await updateAssignmentStatus({
					customerId: targetCustomerId,
					status: normalizedStatus,
					note,
					coachId: coachUid,
					assessorId,
				});
				return true;
			} catch (error) {
				const details =
					error?.data?.error ||
					error?.data?.message ||
					error?.message ||
					"Het bijwerken van de status is mislukt.";
				setStatusUpdateError(details);
				return false;
			} finally {
				setStatusUpdating(false);
			}
		},
		[coachUid, selectedCustomerId, statusUpdating]
	);

	const openAssessorSelection = useCallback(async () => {
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
		if (!selectedAssignment) {
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
				customerId: selectedAssignment.customerId || selectedAssignment.id,
				status: TRAJECT_STATUS.ASSESSMENT,
				coachId: coachUid,
				assessorId: selectedAssessorId,
			});
			setAssessorModalOpen(false);
		} catch (error) {
			setAssessorError(error?.data?.error || error?.message || "Doorsturen naar assessor is mislukt.");
		} finally {
			setAssessorLoading(false);
		}
	}, [coachUid, selectedAssessorId, selectedAssignment]);

	const handleAdvanceStatus = useCallback(
		async ({ note } = {}) => {
			const assignment = selectedAssignment;
			if (!assignment) {
				setStatusUpdateError("Selecteer een kandidaat om de status te wijzigen.");
				return false;
			}
			const currentStatus = normalizeTrajectStatus(assignment.status);
			const nextStatus = getNextTrajectStatus(currentStatus);
			if (!nextStatus) {
				setStatusUpdateError("Geen vervolgstap beschikbaar.");
				return false;
			}
			// If coordinator advancing to ASSESSMENT, require assessor selection first
			if (resolvedRole === "kwaliteitscoordinator" && nextStatus === TRAJECT_STATUS.ASSESSMENT) {
				openAssessorSelection();
				return false;
			}
			return performStatusUpdate({
				customerId: assignment.customerId || assignment.id,
				status: nextStatus,
				note,
			});
		},
		[openAssessorSelection, performStatusUpdate, resolvedRole, selectedAssignment]
	);

	const handleRewindStatus = useCallback(
		async ({ note } = {}) => {
			const assignment = selectedAssignment;
			if (!assignment) {
				setStatusUpdateError("Selecteer een kandidaat om de status te wijzigen.");
				return false;
			}
			const currentStatus = normalizeTrajectStatus(assignment.status);
			const previousStatus = getPreviousTrajectStatus(currentStatus);
			if (!previousStatus) {
				setStatusUpdateError("Geen vorige stap beschikbaar.");
				return false;
			}
			return performStatusUpdate({
				customerId: assignment.customerId || assignment.id,
				status: previousStatus,
				note,
			});
		},
		[performStatusUpdate, selectedAssignment]
	);

	const topbarUser = {
		name:
			coachDoc?.name ||
			sqlUser?.name ||
			coachDoc?.email ||
			sqlUser?.email ||
			"Begeleider",
		subtitle,
		role: roleLabel,
		email: coachDoc?.email || sqlUser?.email || "",
		photoURL: coachDoc?.photoURL || sqlUser?.photoURL || sqlUser?.photoUrl || null,
	};

	const handleExitImpersonation = async () => {
		if (!isImpersonating) {
			navigate("/admin", { replace: true });
			return;
		}

		let backup = impersonationBackup;
		if (!backup) {
			try {
				const raw = localStorage.getItem("impersonationBackup");
				backup = raw ? JSON.parse(raw) : null;
			} catch (_) {
				backup = null;
			}
		}

		let adminSignInError = null;
		if (backup?.adminCustomToken) {
			try {
				await signInWithCustomToken(auth, backup.adminCustomToken);
				try {
					await post("/auth/track-login", {});
				} catch (_) {
					// best-effort tracking, non-blocking
				}
			} catch (error) {
				adminSignInError = error;
			}
		}

		if (backup && Object.prototype.hasOwnProperty.call(backup, "user")) {
			if (backup.user === null) {
				localStorage.removeItem("user");
				setSqlUser(null);
			} else {
				localStorage.setItem("user", backup.user);
				try {
					setSqlUser(normalizeUserRecord(JSON.parse(backup.user)));
				} catch (_) {
					setSqlUser(null);
				}
			}
		} else {
			localStorage.removeItem("user");
			setSqlUser(null);
		}

		localStorage.removeItem("impersonationBackup");
		setImpersonationBackup(null);
		setCoachDoc(null);
		setCoachProfileError(null);
		setCustomersList([]);
		setCustomersError(null);
		setAssignments([]);
		setAssignmentsError(null);
		// feedback removed
		setUnreadMessages([]);
		setUnreadMessagesError(null);
		setSelectedCustomerId("all");

		if (adminSignInError) {
			localStorage.removeItem("user");
			setSqlUser(null);
			navigate("/", { replace: true });
			return;
		}

		navigate("/admin", { replace: true });
	};

	const handleLogout = async () => {
		try {
			await signOut(auth);
		} catch (_) {
			// best-effort sign-out
		}
		localStorage.removeItem("token");
		localStorage.removeItem("user");
		localStorage.removeItem("impersonationBackup");
		setImpersonationBackup(null);
		setSqlUser(null);
		setCoachDoc(null);
		setCoachProfileError(null);
		setCustomersList([]);
		setCustomersError(null);
		setAssignments([]);
		setAssignmentsError(null);
		// feedback removed
		setUnreadMessages([]);
		setUnreadMessagesError(null);
		setSelectedCustomerId("all");
		navigate("/", { replace: true });
	};

	const customersForContext = useMemo(
		() => (resolvedRole === "coach" ? customersList : assignedCustomers),
		[assignedCustomers, customersList, resolvedRole]
	);

	const contextValue = useMemo(
		() => ({
			coach: coachDoc,
			account: sqlUser,
			customers: customersForContext,
			assignments,
			// feedback removed
			selectedCustomer,
			selectedCustomerId,
			setSelectedCustomerId,
			selectedAssignment,
			unreadMessages,
			unreadMessagesByThread,
			unreadMessageSummary,
			role: resolvedRole,
			roleLabel,
			basePath: normalizedBasePath,
			navigation: {
				items: coachNavItems,
				basePath: normalizedBasePath,
			},
			statusUpdating,
			statusUpdateError,
			statusWorkflow: {
				update: performStatusUpdate,
				advance: handleAdvanceStatus,
				rewind: handleRewindStatus,
			},
			errors: {
				user: userError,
				profile: coachProfileError,
				customers: customersError,
				assignments: assignmentsError,
				// feedback removed
				messages: unreadMessagesError,
			},
			loading: {
				user: loadingUser,
			},
		}),
		[
			assignments,
			assignmentsError,
			coachDoc,
			coachProfileError,
			coachNavItems,
			customersError,
			customersForContext,
			// feedback removed
			handleAdvanceStatus,
			handleRewindStatus,
			loadingUser,
			normalizedBasePath,
			performStatusUpdate,
			resolvedRole,
			roleLabel,
			selectedAssignment,
			selectedCustomer,
			selectedCustomerId,
			sqlUser,
			statusUpdateError,
			statusUpdating,
			unreadMessageSummary,
			unreadMessages,
			unreadMessagesByThread,
			unreadMessagesError,
			userError,
		]
	);

	return (
		<DashboardLayout
			className="bg-white"
			mainClassName="bg-white"
			sidebar={
				<Sidebar
					tone="dark"
					header={
						<div className="space-y-4 text-white">
							<BrandLogo className="w-fit" tone="dark" />
							<div className="space-y-1">
								<p className="text-xs uppercase tracking-[0.35em] text-white/60">{roleLabel}</p>
								<h1 className="text-xl font-semibold text-white">EVC Werkruimte</h1>
							</div>
						</div>
					}
					navItems={coachNavItems}
				/>
			}
			topbar={
				<Topbar
					title={`${roleLabel} dashboard`}
					tone="brand"
					user={topbarUser}
					logoTo={normalizedBasePath}
					rightSlot={
						<div className="flex items-center gap-3">
							{isImpersonating ? (
								<button
									type="button"
									onClick={handleExitImpersonation}
									className="rounded-full border border-white/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
								>
									Stop meespelen
								</button>
							) : null}
							<select
								value={selectedCustomerId}
								onChange={(event) => setSelectedCustomerId(event.target.value)}
								className="h-10 rounded-full border border-white/30 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
							>
								{customerOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
							<button
								type="button"
								onClick={handleLogout}
								className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-evc-blue-600 shadow-lg transition hover:bg-white/90"
							>
								Afmelden
							</button>
						</div>
					}
				/>
			}
		>
			<Outlet context={contextValue} />
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
		</DashboardLayout>
	);
};

const CustomerLayout = () => {
	const navigate = useNavigate();
	const [sqlUser, setSqlUser] = useState(() => {
		try {
			const raw = localStorage.getItem("user") || "null";
			return normalizeUserRecord(JSON.parse(raw));
		} catch (_) {
			return null;
		}
	});
	const [impersonationBackup, setImpersonationBackup] = useState(() => {
		try {
			const raw = localStorage.getItem("impersonationBackup");
			return raw ? JSON.parse(raw) : null;
		} catch (_) {
			return null;
		}
	});
	const [loadingUser, setLoadingUser] = useState(!sqlUser);
	const [userError, setUserError] = useState(null);
	const [customerDoc, setCustomerDoc] = useState(null);
	const [coachDoc, setCoachDoc] = useState(null);
	const [assignmentDoc, setAssignmentDoc] = useState(null);
	const [firestoreError, setFirestoreError] = useState(null);
	const location = useLocation();

	useEffect(() => {
		let active = true;
		const loadUser = async () => {
			setLoadingUser(true);
			try {
				const data = await get("/auth/me");
				if (!active) return;
				setSqlUser((prev) => {
					const merged = normalizeUserRecord({ ...(prev || {}), ...(data || {}) });
					try {
						localStorage.setItem("user", JSON.stringify(merged));
					} catch (_) {
						// ignore storage failures
					}
					return merged;
				});
				setUserError(null);
			} catch (error) {
				if (!active) return;
				setUserError(error);
			} finally {
				if (active) setLoadingUser(false);
			}
		};

		loadUser();
		return () => {
			active = false;
		};
	}, []);

	const firebaseUid = sqlUser?.firebaseUid || sqlUser?.uid || null;

			useResubscribingListener(
					(helpers) => {
				if (!firebaseUid) {
					setCustomerDoc(null);
					setCoachDoc(null);
					setAssignmentDoc(null);
					setFirestoreError(null);
					return () => {};
				}
				return subscribeCustomerContext(
					firebaseUid,
					({ customer, coach, assignment, error }) => {
						if (error) {
							setFirestoreError(error);
								return;
						}
						setFirestoreError(null);
						if (customer !== undefined) setCustomerDoc(customer || null);
						if (coach !== undefined) setCoachDoc(coach || null);
						if (assignment !== undefined) setAssignmentDoc(assignment || null);
					}
				);
			},
					[firebaseUid],
			{ name: "customer:context" }
		);

	const resolvedCustomer = useMemo(() => {
		if (customerDoc) {
			const normalizedUid = customerDoc.firebaseUid || customerDoc.id || null;
			return normalizedUid ? { ...customerDoc, firebaseUid: normalizedUid, uid: normalizedUid } : customerDoc;
		}
		if (!sqlUser) return null;
		const fallbackUid =
			sqlUser.firebaseUid ||
			sqlUser.uid ||
			(sqlUser.id ? String(sqlUser.id) : null);
		if (!fallbackUid) return null;
		return {
			id: fallbackUid,
			uid: fallbackUid,
			firebaseUid: fallbackUid,
			name: sqlUser.name || sqlUser.email || "Kandidaat",
			email: sqlUser.email || "",
			role: sqlUser.role || "customer",
			trajectId: sqlUser.trajectId || null,
			photoURL: sqlUser.photoURL || sqlUser.photoUrl || null,
		};
	}, [customerDoc, sqlUser]);

	const resolvedCoach = useMemo(() => {
		if (coachDoc) return coachDoc;
		return null;
	}, [coachDoc]);

	const normalizedAssignmentStatus = useMemo(
		() => normalizeTrajectStatus(assignmentDoc?.status),
		[assignmentDoc?.status]
	);

	const customerNavItems = useMemo(() => {
		const items = [...BASE_CUSTOMER_NAV_ITEMS];
		if (isCollectingStatus(normalizedAssignmentStatus)) {
			return [...items.filter((item) => item.to !== READY_NAV_ITEM.to), READY_NAV_ITEM];
		}
		return items;
	}, [normalizedAssignmentStatus]);

		const activityLabel = useMemo(() => {
			if (!resolvedCustomer?.lastActivity) return "-";
			const value = resolvedCustomer.lastActivity;
			if (value instanceof Date) {
				return value.toLocaleString();
			}
			if (typeof value === "string") return value;
			return "-";
		}, [resolvedCustomer?.lastActivity]);

		const isImpersonating = Boolean(impersonationBackup);
		const impersonatingAdminLabel = useMemo(() => {
			if (!impersonationBackup?.userData) return null;
			const { name, email } = impersonationBackup.userData;
			return name || email || null;
		}, [impersonationBackup]);

		const subtitleParts = [];
		if (isImpersonating) {
			subtitleParts.push(`Meekijken door ${impersonatingAdminLabel || "Beheerder"}`);
		}
		if (resolvedCoach?.name) subtitleParts.push(`Begeleider: ${resolvedCoach.name}`);
		if (assignmentDoc?.status) {
			const statusLabel = getTrajectStatusLabel(assignmentDoc.status);
			if (statusLabel && statusLabel !== "Onbekend") {
				subtitleParts.push(statusLabel);
			}
		}
		const subtitle = subtitleParts.join(" • ") || "Kandidaat";

		const activeCustomerNav = useMemo(() => {
			const currentPath = location.pathname;
			return (
				customerNavItems.find((item) => currentPath.startsWith(item.to)) ||
				customerNavItems[0]
			);
		}, [customerNavItems, location.pathname]);

		const topbarTitle = activeCustomerNav?.label || "Mijn EVC";

		const topbarUser = {
			name: resolvedCustomer?.name || "Kandidaat",
			subtitle,
			role: "Kandidaat",
			email: resolvedCustomer?.email || sqlUser?.email || "",
			photoURL:
				resolvedCustomer?.photoURL ||
				sqlUser?.photoURL ||
				sqlUser?.photoUrl ||
				null,
		};

	const handleCustomerLogout = async () => {
		try {
			await signOut(auth);
		} catch (_) {
			// sign-out best effort
		}
		localStorage.removeItem("user");
		localStorage.removeItem("impersonationBackup");
		setSqlUser(null);
		setImpersonationBackup(null);
		setCustomerDoc(null);
		setCoachDoc(null);
		setAssignmentDoc(null);
		navigate("/", { replace: true });
	};

	const handleExitImpersonation = async () => {
		if (!isImpersonating) {
			navigate("/admin", { replace: true });
			return;
		}

		let backup = impersonationBackup;
		if (!backup) {
			try {
				const raw = localStorage.getItem("impersonationBackup");
				backup = raw ? JSON.parse(raw) : null;
			} catch (_) {
				backup = null;
			}
		}

		let adminSignInError = null;
		if (backup?.adminCustomToken) {
			try {
				await signInWithCustomToken(auth, backup.adminCustomToken);
				try {
					await post("/auth/track-login", {});
				} catch (_) {
					// best-effort tracking, non-blocking
				}
			} catch (err) {
				adminSignInError = err;
			}
		}

		if (backup && Object.prototype.hasOwnProperty.call(backup, "user")) {
			if (backup.user === null) {
				localStorage.removeItem("user");
				setSqlUser(null);
			} else {
				localStorage.setItem("user", backup.user);
				try {
					setSqlUser(normalizeUserRecord(JSON.parse(backup.user)));
				} catch (_) {
					setSqlUser(null);
				}
			}
		} else {
			localStorage.removeItem("user");
			setSqlUser(null);
		}

		localStorage.removeItem("impersonationBackup");
		setImpersonationBackup(null);
		setCustomerDoc(null);
		setCoachDoc(null);
		setAssignmentDoc(null);
		if (adminSignInError) {
			// If returning to admin failed, fall back to fresh login.
			localStorage.removeItem("user");
			setSqlUser(null);
			navigate("/login", { replace: true });
			return;
		}
		navigate("/admin", { replace: true });
	};

	return (
		<DashboardLayout
			className="bg-white"
			mainClassName="bg-white"
			sidebar={
				<Sidebar
					tone="dark"
					header={
						<div className="space-y-4 text-white">
							<BrandLogo className="w-fit" tone="dark" />
							<div className="space-y-1">
								<p className="text-xs uppercase tracking-[0.35em] text-white/60">Kandidaat</p>
								<h1 className="text-xl font-semibold text-white">Mijn EVC</h1>
							</div>
						</div>
					}
					navItems={customerNavItems}
				/>
			}
			topbar={
				<Topbar
					title={topbarTitle}
					tone="brand"
					user={topbarUser}
					logoTo="/customer/dashboard"
					rightSlot={
						<div className="flex flex-wrap items-center justify-end gap-3 text-sm text-white">
							{isImpersonating ? (
								<button
									type="button"
									onClick={handleExitImpersonation}
									className="rounded-full border border-white/40 bg-white/10 px-3 py-1 font-semibold text-white transition hover:bg-white/20"
								>
									Stop meekijken
								</button>
							) : null}
							<button
								type="button"
								onClick={handleCustomerLogout}
								className="rounded-full bg-white px-3 py-1 font-semibold text-evc-blue-600 shadow-sm transition hover:bg-white/90"
							>
								Log uit
							</button>
							<span className="rounded-full bg-white/10 px-3 py-1 font-medium text-white/90 shadow-sm">
								Laatste activiteit: {activityLabel}
							</span>
							{resolvedCoach ? (
								<span className="hidden rounded-full bg-white px-3 py-1 font-medium text-evc-blue-600 sm:inline">
									Begeleider {resolvedCoach.name}
								</span>
							) : null}
						</div>
					}
				/>
			}
		>
			<Outlet
				context={{
					customer: resolvedCustomer,
					coach: resolvedCoach,
					assignment: assignmentDoc,
					account: sqlUser,
					loadingUser,
					userError,
					firestoreError,
				}}
			/>
		</DashboardLayout>
	);
};

const App = () => {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/login" element={<Login />} />
				<Route path="/testing/create-account" element={<TestCreateAccount />} />
				<Route path="/admin" element={<AdminLayout />}>
					<Route index element={<AdminDashboard />} />
					<Route path="assignments" element={<AdminAssignments />} />
					<Route path="trajects" element={<AdminTrajects />} />
					<Route path="profile" element={<AdminProfile />} />
					<Route path="manual" element={<CustomerManual />} />
					<Route path="users" element={<AdminUsers />} />
					<Route path="users/create" element={<AdminCreateUser />} />
				</Route>

				<Route path="/coach" element={<CoachLayout />}>
					<Route index element={<CoachDashboard />} />
					<Route path="customers" element={<CoachCustomers />} />
					<Route path="customers/:customerId" element={<CoachCustomerCompetency />} />
					<Route path="aantekeningen" element={<CoachNotes />} />
					<Route path="messages" element={<CoachMessages />} />
					<Route path="manual" element={<CustomerManual />} />
									<Route path="profile" element={<CoachProfile />} />
				</Route>

				<Route
					path="/kwaliteitscoordinator"
					element={<CoachLayout roleOverride="kwaliteitscoordinator" basePath="/kwaliteitscoordinator" />}
				>
					<Route index element={<CoachDashboard />} />
					<Route path="customers" element={<CoachCustomers />} />
					<Route path="customers/:customerId" element={<CoachCustomerCompetency />} />
					<Route path="aantekeningen" element={<CoachNotes />} />
					<Route path="messages" element={<CoachMessages />} />
					<Route path="manual" element={<CustomerManual />} />
									<Route path="profile" element={<CoachProfile />} />
				</Route>

				<Route
					path="/assessor"
					element={<CoachLayout roleOverride="assessor" basePath="/assessor" />}
				>
					<Route index element={<CoachDashboard />} />
					<Route path="customers" element={<CoachCustomers />} />
					<Route path="customers/:customerId" element={<CoachCustomerCompetency />} />
					<Route path="aantekeningen" element={<CoachNotes />} />
					<Route path="messages" element={<CoachMessages />} />
					<Route path="manual" element={<CustomerManual />} />
									<Route path="profile" element={<CoachProfile />} />
				</Route>

				<Route path="/customer" element={<CustomerLayout />}>
					<Route index element={<Navigate to="/customer/dashboard" replace />} />
					<Route path="dashboard" element={<CustomerDashboard />} />
					<Route path="profile" element={<CustomerProfile />} />
					<Route path="career-goal" element={<CustomerCareerGoal />} />
					  <Route path="vragenlijst" element={<CustomerVragenlijst />} />
					  <Route path="portfolio" element={<CustomerPlanning />} />
					<Route path="klaar" element={<CustomerReady />} />
					<Route path="workplace-visit" element={<CustomerWorkplaceVisit />} />
					<Route path="criterium-interview" element={<CustomerCriteriumInterview />} />
					<Route path="contact" element={<CustomerMessages />} />
					<Route path="manual" element={<CustomerManual />} />
				</Route>

				{/* Backward-compat: old .html paths */}
				<Route path="/Login.html" element={<Navigate to="/login" replace />} />
				<Route path="/Dashboard.html" element={<Navigate to="/admin" replace />} />
				<Route path="/Profile.html" element={<Navigate to="/customer/profile" replace />} />
				<Route path="/Planning.html" element={<Navigate to="/customer/portfolio" replace />} />
				<Route path="/Messages.html" element={<Navigate to="/customer/contact" replace />} />
				<Route path="/Evidence.html" element={<Navigate to="/customer/portfolio" replace />} />
				<Route path="/index.html" element={<Navigate to="/" replace />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
};

export default App;

