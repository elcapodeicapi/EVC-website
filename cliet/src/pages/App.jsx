import React, { useEffect, useMemo, useState } from "react";
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
import AdminOverview from "./admin/Overview";
import AdminAssignments from "./admin/Assignments";
import AdminTrajects from "./admin/Trajects";
import AdminProfile from "./admin/Profile";
import AdminUsers from "./admin/Users";
import TestCreateAccount from "./TestCreateAccount";
import CustomerDashboard from "./customer/Dashboard";
import CustomerPlanning from "./customer/Planning";
import CustomerMessages from "./customer/Messages";
import CustomerProfile from "./customer/Profile";
import CustomerCareerGoal from "./customer/CareerGoal";
import CustomerWorkplaceVisit from "./customer/WorkplaceVisit";
import CustomerCriteriumInterview from "./customer/CriteriumInterview";
import CustomerManual from "./customer/Manual";
import CoachDashboard from "./coach/Dashboard";
import CoachCustomers from "./coach/Customers";
import CoachCustomerCompetency from "./coach/CustomerCompetency";
import CoachFeedback from "./coach/Feedback";
import CoachMessages from "./coach/Messages";
import CoachNotes from "./coach/AantekeningenOverzicht";
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
} from "lucide-react";
import { onAuthStateChanged, signOut, signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebase";
import { subscribeAdminProfile } from "../lib/firestoreAdmin";
import { subscribeCustomerContext } from "../lib/firestoreCustomer";
import {
	subscribeCoachAssignments,
	subscribeCoachCustomers,
	subscribeCoachFeedback,
	subscribeCoachProfile,
} from "../lib/firestoreCoach";
import { get } from "../lib/api";

const ADMIN_NAV_ITEMS = [
	{ label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
	{ label: "Assignments", to: "/admin/assignments", icon: FileSpreadsheet },
	{ label: "Trajects", to: "/admin/trajects", icon: FileText },
	{ label: "Users", to: "/admin/users", icon: UsersIcon },
	{ label: "Profile", to: "/admin/profile", icon: IdCard },
];

const COACH_NAV_ITEMS = [
	{ label: "Dashboard", to: "/coach", icon: LayoutDashboard, end: true },
	{ label: "My Customers", to: "/coach/customers", icon: UsersIcon },
	{ label: "Feedback", to: "/coach/feedback", icon: FileText },
	{ label: "Aantekeningen", to: "/coach/aantekeningen", icon: NotebookPen },
	{ label: "Messages", to: "/coach/messages", icon: Mail },
];

const CUSTOMER_NAV_ITEMS = [
	{ label: "Dashboard", to: "/customer/dashboard", icon: LayoutDashboard, end: true },
	{ label: "Mijn profiel", to: "/customer/profile", icon: IdCard },
	{ label: "Mijn loopbaandoel", to: "/customer/career-goal", icon: Goal },
	{ label: "Mijn portfolio", to: "/customer/portfolio", icon: FolderOpen },
	{ label: "Werkplekbezoek", to: "/customer/workplace-visit", icon: Briefcase },
	{ label: "Criteriumgericht interview", to: "/customer/criterium-interview", icon: ClipboardCheck },
	{ label: "Contact", to: "/customer/contact", icon: MessageSquare },
	{ label: "Handleiding", to: "/customer/manual", icon: BookOpen },
];

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
		navigate("/login", { replace: true });
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

	const displayName = profile?.name || profile?.email || "Admin";
	const displayRole = profile?.role
		? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
		: "Administrator";
	const subtitle = profileError ? "Administrator" : displayRole;

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
								<p className="text-xs uppercase tracking-[0.35em] text-white/60">Admin</p>
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
							Sign out
						</button>
					}
				/>
			}
			topbar={
				<Topbar
					title="Administration overview"
					tone="brand"
					user={{ name: displayName, subtitle, role: "Admin" }}
					logoTo="/admin"
					rightSlot={
						<div className="hidden items-center gap-3 md:flex">
							<button
								type="button"
								onClick={() => alert("Mock: generate report")}
								className="rounded-full border border-white/40 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
							>
								Generate report
							</button>
							<button
								type="button"
								onClick={handleLogout}
								className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-evc-blue-600 shadow-lg transition hover:bg-white/90"
							>
								Sign out
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

const CoachLayout = () => {
	const navigate = useNavigate();
	const [sqlUser, setSqlUser] = useState(() => {
		try {
			const raw = localStorage.getItem("user") || "null";
			return normalizeUserRecord(JSON.parse(raw));
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

	useEffect(() => {
		if (!coachUid) {
			setCoachDoc(null);
			setCoachProfileError(null);
			return () => {};
		}
		const unsubscribe = subscribeCoachProfile(coachUid, ({ data, error }) => {
			if (error) {
				setCoachProfileError(error);
				setCoachDoc(null);
				return;
			}
			setCoachProfileError(null);
			setCoachDoc(data || null);
		});
		return () => {
			if (typeof unsubscribe === "function") unsubscribe();
		};
	}, [coachUid]);

	const [customersList, setCustomersList] = useState([]);
	const [customersError, setCustomersError] = useState(null);

	useEffect(() => {
		if (!coachUid) {
			setCustomersList([]);
			setCustomersError(null);
			return () => {};
		}
		const unsubscribe = subscribeCoachCustomers(coachUid, ({ data, error }) => {
			if (error) {
				setCustomersError(error);
				setCustomersList([]);
				return;
			}
			setCustomersError(null);
			setCustomersList(Array.isArray(data) ? data : []);
		});
		return () => {
			if (typeof unsubscribe === "function") unsubscribe();
		};
	}, [coachUid]);

	const [assignments, setAssignments] = useState([]);
	const [assignmentsError, setAssignmentsError] = useState(null);

	useEffect(() => {
		if (!coachUid) {
			setAssignments([]);
			setAssignmentsError(null);
			return () => {};
		}
		const unsubscribe = subscribeCoachAssignments(coachUid, ({ data, error }) => {
			if (error) {
				setAssignmentsError(error);
				setAssignments([]);
				return;
			}
			setAssignmentsError(null);
			setAssignments(Array.isArray(data) ? data : []);
		});
		return () => {
			if (typeof unsubscribe === "function") unsubscribe();
		};
	}, [coachUid]);

	const [feedbackItems, setFeedbackItems] = useState([]);
	const [feedbackError, setFeedbackError] = useState(null);

	useEffect(() => {
		if (!coachUid) {
			setFeedbackItems([]);
			setFeedbackError(null);
			return () => {};
		}
		const unsubscribe = subscribeCoachFeedback(coachUid, ({ data, error }) => {
			if (error) {
				setFeedbackError(error);
				setFeedbackItems([]);
				return;
			}
			setFeedbackError(null);
			setFeedbackItems(Array.isArray(data) ? data : []);
		});
		return () => {
			if (typeof unsubscribe === "function") unsubscribe();
		};
	}, [coachUid]);

	const customerOptions = useMemo(() => {
		const options = [
			{ value: "all", label: "Alle klanten" },
			...customersList.map((customer) => ({
				value: customer.id,
				label: customer.name || customer.email || "Unknown customer",
			})),
		];
		return options;
	}, [customersList]);

	const [selectedCustomerId, setSelectedCustomerId] = useState("all");

	useEffect(() => {
		if (!customerOptions.some((option) => option.value === selectedCustomerId)) {
			setSelectedCustomerId(customerOptions[0]?.value || "all");
		}
	}, [customerOptions, selectedCustomerId]);

	const selectedCustomer = useMemo(
		() =>
			selectedCustomerId === "all"
				? null
				: customersList.find((customer) => customer.id === selectedCustomerId) || null,
		[selectedCustomerId, customersList]
	);

	const subtitle = useMemo(() => {
		if (selectedCustomer) {
			return `Focus: ${selectedCustomer.name || selectedCustomer.email || "Customer"}`;
		}
		if (customersList.length === 0) {
			return "Geen klanten gekoppeld";
		}
		return `${customersList.length} klanten gekoppeld`;
	}, [selectedCustomer, customersList.length]);

	const topbarUser = {
		name:
			coachDoc?.name ||
			sqlUser?.name ||
			coachDoc?.email ||
			sqlUser?.email ||
			"Coach",
		subtitle,
		role: "Coach",
		email: coachDoc?.email || sqlUser?.email || "",
		photoURL: coachDoc?.photoURL || sqlUser?.photoURL || sqlUser?.photoUrl || null,
	};

	const handleLogout = () => {
		localStorage.removeItem("token");
		localStorage.removeItem("user");
		navigate("/login", { replace: true });
	};

	const contextValue = useMemo(
		() => ({
			coach: coachDoc,
			account: sqlUser,
			customers: customersList,
			assignments,
			feedback: feedbackItems,
			selectedCustomer,
			errors: {
				user: userError,
				profile: coachProfileError,
				customers: customersError,
				assignments: assignmentsError,
				feedback: feedbackError,
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
			customersError,
			customersList,
			feedbackError,
			feedbackItems,
			loadingUser,
			selectedCustomer,
			sqlUser,
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
								<p className="text-xs uppercase tracking-[0.35em] text-white/60">Coach</p>
								<h1 className="text-xl font-semibold text-white">EVC Workspace</h1>
							</div>
						</div>
					}
					navItems={COACH_NAV_ITEMS}
				/>
			}
			topbar={
				<Topbar
					title="Coaching dashboard"
					tone="brand"
					user={topbarUser}
					logoTo="/coach"
					rightSlot={
						<div className="flex items-center gap-3">
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
								Sign out
							</button>
						</div>
					}
				/>
			}
		>
			<Outlet context={contextValue} />
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

	useEffect(() => {
		if (!firebaseUid) {
			setCustomerDoc(null);
			setCoachDoc(null);
			setAssignmentDoc(null);
			setFirestoreError(null);
			return undefined;
		}

		const unsubscribe = subscribeCustomerContext(firebaseUid, ({ customer, coach, assignment, error }) => {
			if (error) {
				setFirestoreError(error);
				return;
			}
			setFirestoreError(null);
			if (customer !== undefined) setCustomerDoc(customer || null);
			if (coach !== undefined) setCoachDoc(coach || null);
			if (assignment !== undefined) setAssignmentDoc(assignment || null);
		});

		return () => {
			if (typeof unsubscribe === "function") {
				unsubscribe();
			}
		};
	}, [firebaseUid]);

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
			name: sqlUser.name || sqlUser.email || "Customer",
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
			subtitleParts.push(`Meekijken door ${impersonatingAdminLabel || "Admin"}`);
		}
		if (resolvedCoach?.name) subtitleParts.push(`Coach: ${resolvedCoach.name}`);
		if (assignmentDoc?.status) subtitleParts.push(assignmentDoc.status);
		const subtitle = subtitleParts.join(" • ") || "Customer";

		const activeCustomerNav = useMemo(() => {
			const currentPath = location.pathname;
			return (
				CUSTOMER_NAV_ITEMS.find((item) => currentPath.startsWith(item.to)) ||
				CUSTOMER_NAV_ITEMS[0]
			);
		}, [location.pathname]);

		const topbarTitle = activeCustomerNav?.label || "Mijn EVC";

	const topbarUser = {
		name: resolvedCustomer?.name || "Customer",
		subtitle,
		role: "Customer",
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
		navigate("/login", { replace: true });
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
								<p className="text-xs uppercase tracking-[0.35em] text-white/60">Customer</p>
								<h1 className="text-xl font-semibold text-white">Mijn EVC</h1>
							</div>
						</div>
					}
					navItems={CUSTOMER_NAV_ITEMS}
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
									Coach {resolvedCoach.name}
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
					<Route index element={<AdminOverview />} />
					<Route path="assignments" element={<AdminAssignments />} />
					<Route path="trajects" element={<AdminTrajects />} />
					<Route path="profile" element={<AdminProfile />} />
					<Route path="users" element={<AdminUsers />} />
				</Route>

				<Route path="/coach" element={<CoachLayout />}>
					<Route index element={<CoachDashboard />} />
					<Route path="customers" element={<CoachCustomers />} />
					<Route path="customers/:customerId" element={<CoachCustomerCompetency />} />
					<Route path="feedback" element={<CoachFeedback />} />
					<Route path="aantekeningen" element={<CoachNotes />} />
					<Route path="messages" element={<CoachMessages />} />
				</Route>

				<Route path="/customer" element={<CustomerLayout />}>
					<Route index element={<Navigate to="/customer/dashboard" replace />} />
					<Route path="dashboard" element={<CustomerDashboard />} />
					<Route path="profile" element={<CustomerProfile />} />
					<Route path="career-goal" element={<CustomerCareerGoal />} />
					<Route path="portfolio" element={<CustomerPlanning />} />
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

