import React, { useEffect, useMemo, useState } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	Outlet,
	useNavigate,
} from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Login from "./Login";
import Home from "./Home";
import AdminOverview from "./admin/Overview";
import AdminAssignments from "./admin/Assignments";
import AdminTrajects from "./admin/Trajects";
import AdminProfile from "./admin/Profile";
import AdminUsers from "./admin/Users";
import TestCreateAccount from "./TestCreateAccount";
import CustomerPlanning from "./customer/Planning";
import CustomerMessages from "./customer/Messages";
import CustomerProfile from "./customer/Profile";
import CoachDashboard from "./coach/Dashboard";
import CoachCustomers from "./coach/Customers";
import CoachCustomerCompetency from "./coach/CustomerCompetency";
import CoachFeedback from "./coach/Feedback";
import CoachMessages from "./coach/Messages";
import {
	LayoutDashboard,
	Users as UsersIcon,
	FileSpreadsheet,
	FileText,
	Mail,
	CalendarCheck,
	MessageSquare,
	IdCard,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
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
	{ label: "Messages", to: "/coach/messages", icon: Mail },
];

const CUSTOMER_NAV_ITEMS = [
	{ label: "Planning", to: "/customer/planning", icon: CalendarCheck },
	{ label: "Messages", to: "/customer/messages", icon: MessageSquare },
	{ label: "Profile", to: "/customer/profile", icon: IdCard },
];

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
				if (parsed?.firebaseUid && mounted) {
					setUid(parsed.firebaseUid);
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
			sidebar={
				<Sidebar
					header={
						<div>
							<p className="text-xs uppercase tracking-[0.35em] text-slate-400">Admin</p>
							<h1 className="mt-1 text-xl font-semibold text-slate-900">EVC Control</h1>
						</div>
					}
					navItems={ADMIN_NAV_ITEMS}
					footer={
						<button
							type="button"
							onClick={handleLogout}
							className="flex w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-600"
						>
							Sign out
						</button>
					}
				/>
			}
			topbar={
				<Topbar
					title="Administration overview"
								user={{ name: displayName, subtitle, role: "Admin" }}
					rightSlot={
						<div className="hidden items-center gap-3 md:flex">
							<button
								type="button"
								onClick={() => alert("Mock: generate report")}
								className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-600"
							>
								Generate report
							</button>
							<button
								type="button"
								onClick={handleLogout}
								className="rounded-full bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-500"
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
			return JSON.parse(localStorage.getItem("user") || "null");
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
					const merged = { ...(previous || {}), ...(data || {}) };
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

	const coachUid = sqlUser?.firebaseUid || null;

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
			sidebar={
				<Sidebar
					header={
						<div>
							<p className="text-xs uppercase tracking-widest text-slate-400">Coach</p>
							<h1 className="mt-1 text-xl font-semibold text-slate-900">EVC Workspace</h1>
						</div>
					}
					navItems={COACH_NAV_ITEMS}
				/>
			}
			topbar={
				<Topbar
					title="Coaching dashboard"
					user={topbarUser}
					rightSlot={
						<div className="flex items-center gap-3">
							<select
								value={selectedCustomerId}
								onChange={(event) => setSelectedCustomerId(event.target.value)}
								className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
								className="rounded-full bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-500"
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
			return JSON.parse(localStorage.getItem("user") || "null");
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

	useEffect(() => {
		let active = true;
		const loadUser = async () => {
			setLoadingUser(true);
			try {
				const data = await get("/auth/me");
				if (!active) return;
				setSqlUser((prev) => {
					const merged = { ...(prev || {}), ...(data || {}) };
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

	const firebaseUid = sqlUser?.firebaseUid || null;

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
		if (customerDoc) return customerDoc;
		if (!sqlUser) return null;
		return {
			id: sqlUser.firebaseUid || String(sqlUser.id || ""),
			name: sqlUser.name || sqlUser.email || "Customer",
			email: sqlUser.email || "",
			role: sqlUser.role || "customer",
			trajectId: sqlUser.trajectId || null,
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

	const topbarUser = {
		name: resolvedCustomer?.name || "Customer",
		subtitle,
		role: "Customer",
	};

		const handleExitImpersonation = () => {
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

			if (backup && Object.prototype.hasOwnProperty.call(backup, "token")) {
				if (backup.token === null) {
					localStorage.removeItem("token");
				} else {
					localStorage.setItem("token", backup.token);
				}
			} else {
				localStorage.removeItem("token");
			}

			if (backup && Object.prototype.hasOwnProperty.call(backup, "user")) {
				if (backup.user === null) {
					localStorage.removeItem("user");
					setSqlUser(null);
				} else {
					localStorage.setItem("user", backup.user);
					try {
						setSqlUser(JSON.parse(backup.user));
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
			navigate("/admin", { replace: true });
		};

	return (
		<DashboardLayout
			sidebar={
				<Sidebar
					header={
						<div>
							<p className="text-xs uppercase tracking-widest text-slate-400">Customer</p>
							<h1 className="mt-1 text-xl font-semibold text-slate-900">Mijn EVC</h1>
						</div>
					}
					navItems={CUSTOMER_NAV_ITEMS}
				/>
			}
			topbar={
				<Topbar
					title="Jouw EVC-traject"
					user={topbarUser}
								rightSlot={
									<div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
										{isImpersonating ? (
											<button
												type="button"
												onClick={handleExitImpersonation}
												className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-semibold text-brand-600 transition hover:bg-brand-100"
											>
												Stop meekijken
											</button>
										) : null}
										<span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
											Laatste activiteit: {activityLabel}
										</span>
										{resolvedCoach ? (
											<span className="hidden rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-600 sm:inline">
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
					<Route path="messages" element={<CoachMessages />} />
				</Route>

				<Route path="/customer" element={<CustomerLayout />}>
					<Route index element={<Navigate to="/customer/planning" replace />} />
					<Route path="planning" element={<CustomerPlanning />} />
					<Route path="messages" element={<CustomerMessages />} />
					<Route path="profile" element={<CustomerProfile />} />
				</Route>

				{/* Backward-compat: old .html paths */}
				<Route path="/Login.html" element={<Navigate to="/login" replace />} />
				<Route path="/Dashboard.html" element={<Navigate to="/admin" replace />} />
				<Route path="/Profile.html" element={<Navigate to="/customer/profile" replace />} />
				<Route path="/Planning.html" element={<Navigate to="/customer/planning" replace />} />
				<Route path="/Messages.html" element={<Navigate to="/customer/messages" replace />} />
				<Route path="/Evidence.html" element={<Navigate to="/customer/planning" replace />} />
				<Route path="/index.html" element={<Navigate to="/" replace />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
};

export default App;

