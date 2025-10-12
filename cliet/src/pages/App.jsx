import React, { useMemo, useState } from "react";
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
import Dashboard from "./Dashboard";
import Login from "./Login";
import Profile from "./Profile";
import Planning from "./Planning";
import Messages from "./Messages";
import Evidence from "./Evidence";
import Home from "./Home";
import AdminOverview from "./admin/Overview";
import AdminAssignments from "./admin/Assignments";
import AdminTrajects from "./admin/Trajects";
import AdminProfile from "./admin/Profile";
import AdminUsers from "./admin/Users";
import TestCreateAccount from "./TestCreateAccount";
import CustomerProcedure from "./customer/Procedure";
import CustomerPlanning from "./customer/Planning";
import CustomerMessages from "./customer/Messages";
import CustomerProfile from "./customer/Profile";
import CoachDashboard from "./coach/Dashboard";
import CoachCustomers from "./coach/Customers";
import CoachCustomerCompetency from "./coach/CustomerCompetency";
import CoachFeedback from "./coach/Feedback";
import CoachMessages from "./coach/Messages";
import CoachSettings from "./coach/Settings";
import CoachProfile from "./coach/Profile";
import {
	adminNavItems,
	coachNavItems,
	customerNavItems,
	adminProfile,
	customers,
	coaches,
} from "../data/mockData";

const CURRENT_CUSTOMER_ID = "cust-1";

const AdminLayout = () => {
	const navigate = useNavigate();

	const handleLogout = () => {
		localStorage.removeItem("token");
		navigate("/login", { replace: true });
	};

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
					navItems={adminNavItems}
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
					user={{ name: adminProfile.name, subtitle: adminProfile.role, role: "Admin" }}
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
	const [selectedCustomer, setSelectedCustomer] = useState("All customers");
	const customerOptions = useMemo(
		() => ["All customers", ...customers.map((customer) => customer.name)],
		[]
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
					navItems={coachNavItems}
				/>
			}
			topbar={
				<Topbar
					title="Coaching dashboard"
					user={{ name: "Isabelle Janssen", subtitle: selectedCustomer, role: "Coach" }}
					rightSlot={
						<div className="flex items-center gap-3">
							<select
								value={selectedCustomer}
								onChange={(event) => setSelectedCustomer(event.target.value)}
								className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
							>
								{customerOptions.map((option) => (
									<option key={option}>{option}</option>
								))}
							</select>
							<button
								type="button"
								onClick={() => alert("Mock logout")}
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

const CustomerLayout = () => {
	const customer = useMemo(
		() => customers.find((item) => item.id === CURRENT_CUSTOMER_ID) ?? customers[0],
		[]
	);

	const coach = useMemo(
		() => coaches.find((item) => item.id === customer?.coachId),
		[customer?.coachId]
	);

	const subtitle = coach ? `Coach: ${coach.name}` : "Customer";

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
					navItems={customerNavItems}
				/>
			}
			topbar={
				<Topbar
					title="Jouw EVC-traject"
					user={{
						name: customer?.name ?? "Customer",
						subtitle,
						role: "Customer",
					}}
					rightSlot={
						<div className="flex items-center gap-3 text-sm text-slate-500">
							<span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
								Laatste activiteit: {customer?.lastActivity ?? "-"}
							</span>
							{coach ? (
								<span className="hidden rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-600 sm:inline">
									Coach {coach.name}
								</span>
							) : null}
						</div>
					}
				/>
			}
		>
			<Outlet context={{ customer, coach }} />
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
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path="/profile" element={<Profile />} />
				<Route path="/planning" element={<Planning />} />
				<Route path="/messages" element={<Messages />} />
				<Route path="/evidence" element={<Evidence />} />

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
					<Route path="profile" element={<CoachProfile />} />
					<Route path="settings" element={<CoachSettings />} />
				</Route>

				<Route path="/customer" element={<CustomerLayout />}>
					<Route index element={<Navigate to="/customer/procedure" replace />} />
					<Route path="procedure" element={<CustomerProcedure />} />
					<Route path="planning" element={<CustomerPlanning />} />
					<Route path="messages" element={<CustomerMessages />} />
					<Route path="profile" element={<CustomerProfile />} />
				</Route>

				{/* Backward-compat: old .html paths */}
				<Route path="/Login.html" element={<Navigate to="/login" replace />} />
				<Route path="/Dashboard.html" element={<Navigate to="/dashboard" replace />} />
				<Route path="/Profile.html" element={<Navigate to="/profile" replace />} />
				<Route path="/Planning.html" element={<Navigate to="/planning" replace />} />
				<Route path="/Messages.html" element={<Navigate to="/messages" replace />} />
				<Route path="/Evidence.html" element={<Navigate to="/evidence" replace />} />
				<Route path="/index.html" element={<Navigate to="/" replace />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
};

export default App;

