import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";

const baseNavItems = [
	{ label: "Dashboard", to: "/dashboard" },
	{ label: "Profile", to: "/profile" },
	{ label: "Planning", to: "/planning" },
	{ label: "Evidence", to: "/evidence" },
	{ label: "Messages", to: "/messages" },
	{ label: "Customer demo", to: "/customer/planning" },
	{ label: "Admin demo", to: "/admin" },
	{ label: "Coach demo", to: "/coach" },
];

const Navbar = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [mobileOpen, setMobileOpen] = useState(false);

	const navItems = useMemo(
		() =>
			baseNavItems.map((item) => ({
				...item,
				active:
					location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
			})),
		[location.pathname]
	);

	const handleNavigate = (to) => {
		navigate(to);
		setMobileOpen(false);
	};

	const handleLogout = () => {
		localStorage.removeItem("token");
		navigate("/login", { replace: true });
		setMobileOpen(false);
	};

	return (
		<header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
				<button
					type="button"
					onClick={() => handleNavigate("/")}
					className="flex items-center gap-2 text-lg font-semibold text-slate-900 transition hover:text-brand-600"
				>
					<span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
						E
					</span>
					<span className="hidden text-sm font-medium text-slate-500 md:block">EVC Portfolio</span>
				</button>

				<nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
					{navItems.map((item) => (
						<button
							key={item.to}
							type="button"
							onClick={() => handleNavigate(item.to)}
							className={`relative transition hover:text-brand-600 ${
								item.active ? "text-brand-600" : ""
							}`}
						>
							{item.label}
							{item.active && (
								<span className="absolute -bottom-2 left-0 right-0 h-0.5 rounded-full bg-brand-500" />
							)}
						</button>
					))}
				</nav>

				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={handleLogout}
						className="hidden items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600 md:inline-flex"
					>
						<LogOut className="h-4 w-4" />
						<span>Logout</span>
					</button>
					<button
						type="button"
						onClick={() => setMobileOpen((previous) => !previous)}
						className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-brand-500 hover:text-brand-600 md:hidden"
						aria-label="Toggle navigation"
					>
						{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			</div>

			{mobileOpen && (
				<div className="border-t border-slate-200 bg-white md:hidden">
					<div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm font-medium text-slate-600">
						{navItems.map((item) => (
							<button
								key={item.to}
								type="button"
								onClick={() => handleNavigate(item.to)}
								className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 ${
									item.active ? "bg-brand-50 text-brand-700" : ""
								}`}
							>
								<span>{item.label}</span>
								{item.active && <span className="text-xs font-semibold uppercase text-brand-600">Now</span>}
							</button>
						))}
						<button
							type="button"
							onClick={handleLogout}
							className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
						>
							<LogOut className="h-4 w-4" />
							<span>Logout</span>
						</button>
					</div>
				</div>
			)}
		</header>
	);
};

export default Navbar;

