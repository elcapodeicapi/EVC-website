// import React, { useEffect, useMemo, useState } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import { LogIn, LogOut, Menu, X } from "lucide-react";
// import { onAuthStateChanged, signOut } from "firebase/auth";
// import BrandLogo from "../components/BrandLogo";
// import { auth } from "../firebase";

// const baseNavItems = [
// 	{ label: "Admin • Dashboard", to: "/admin" },
// 	{ label: "Admin • Opdrachten", to: "/admin/assignments" },
// 	{ label: "Admin • Trajecten", to: "/admin/trajects" },
// 	{ label: "Admin • Gebruikers", to: "/admin/users" },
// 	{ label: "Admin • Profiel", to: "/admin/profile" },
// 	{ label: "Begeleider • Dashboard", to: "/coach" },
// 	{ label: "Begeleider • Mijn kandidaten", to: "/coach/customers" },
// 	{ label: "Begeleider • Feedback", to: "/coach/feedback" },
// 	{ label: "Begeleider • Berichten", to: "/coach/messages" },
// 	{ label: "Kandidaat • Dashboard", to: "/customer/dashboard" },
// 	{ label: "Kandidaat • Berichten", to: "/customer/messages" },
// 	{ label: "Kandidaat • Profiel", to: "/customer/profile" },
// 	{ label: "Test • Account aanmaken", to: "/testing/create-account", badge: "DEV" },
// ];

// const Navbar = () => {
// 	const navigate = useNavigate();
// 	const location = useLocation();
// 	const [mobileOpen, setMobileOpen] = useState(false);
// 	const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(auth.currentUser));

// 	useEffect(() => {
// 		const unsubscribe = onAuthStateChanged(auth, (current) => {
// 			setIsLoggedIn(Boolean(current));
// 		});
// 		return () => unsubscribe();
// 	}, []);

// 	const navItems = useMemo(
// 		() =>
// 			baseNavItems.map((item) => ({
// 				...item,
// 				active:
// 					location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
// 			})),
// 		[location.pathname]
// 	);

// 	const handleNavigate = (to) => {
// 		navigate(to);
// 		setMobileOpen(false);
// 	};

// 	const handleLogout = async () => {
// 		try {
// 			await signOut(auth);
// 		} catch (_) {
// 			// sign-out best effort
// 		}
// 		localStorage.removeItem("user");
// 		localStorage.removeItem("impersonationBackup");
// 		setIsLoggedIn(false);
// 		navigate("/", { replace: true });
// 		setMobileOpen(false);
// 	};

// 	const handleLoginNavigate = () => {
// 		navigate("/login");
// 		setMobileOpen(false);
// 	};

// 	return (
// 		<header className="sticky top-0 z-30 border-b border-evc-blue-500/40 bg-evc-blue-600/95 text-white backdrop-blur">
// 			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
// 				<div className="flex items-center gap-3">
// 					<BrandLogo className="inline-flex shrink-0" tone="dark" />
// 					<button
// 						type="button"
// 						onClick={() => handleNavigate("/")}
// 						className="text-sm font-medium text-white transition hover:text-white/80"
// 					>
// 						EVC-portaal
// 					</button>
// 				</div>

// 				<nav className="hidden items-center gap-6 text-sm font-medium text-white/80 md:flex">
// 					{navItems.map((item) => (
// 						<button
// 							key={item.to}
// 							type="button"
// 							onClick={() => handleNavigate(item.to)}
// 							className={`relative inline-flex items-center gap-2 transition hover:text-white ${
// 								item.active ? "text-white" : ""
// 							}`}
// 						>
// 							<span>{item.label}</span>
// 							{item.badge ? (
// 								<span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white/90">
// 									{item.badge}
// 								</span>
// 							) : null}
// 							{item.active && (
// 								<span className="absolute -bottom-2 left-0 right-0 h-0.5 rounded-full bg-white" />
// 							)}
// 						</button>
// 					))}
// 				</nav>

// 				<div className="flex items-center gap-3">
// 					{isLoggedIn ? (
// 						<button
// 							type="button"
// 							onClick={handleLogout}
// 							className="hidden items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:border-white hover:bg-white/10 md:inline-flex"
// 						>
// 							<LogOut className="h-4 w-4" />
// 							<span>Afmelden</span>
// 						</button>
// 					) : (
// 						<button
// 							type="button"
// 							onClick={handleLoginNavigate}
// 							className="hidden items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:border-white hover:bg-white/10 md:inline-flex"
// 						>
// 							<LogIn className="h-4 w-4" />
// 							<span>Inloggen</span>
// 						</button>
// 					)}
// 					<button
// 						type="button"
// 						onClick={() => setMobileOpen((previous) => !previous)}
// 						className="inline-flex items-center justify-center rounded-full border border-white/40 p-2 text-white transition hover:border-white hover:text-white md:hidden"
// 						aria-label="Navigatie openen of sluiten"
// 					>
// 						{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
// 					</button>
// 				</div>
// 			</div>

// 			{mobileOpen && (
// 				<div className="border-t border-white/20 bg-evc-blue-600/95 text-white md:hidden">
// 					<div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm font-medium text-white/80">
// 						{navItems.map((item) => (
// 							<button
// 								key={item.to}
// 								type="button"
// 								onClick={() => handleNavigate(item.to)}
// 								className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/10 ${
// 									item.active ? "bg-white/10 text-white" : ""
// 								}`}
// 							>
// 								<span className="flex items-center gap-2">
// 									{item.label}
// 									{item.badge ? (
// 										<span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white/90">
// 											{item.badge}
// 										</span>
// 									) : null}
// 								</span>
// 								{item.active && <span className="text-xs font-semibold uppercase text-white">Actief</span>}
// 							</button>
// 						))}
// 						{isLoggedIn ? (
// 							<button
// 								type="button"
// 								onClick={handleLogout}
// 								className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20"
// 							>
// 								<LogOut className="h-4 w-4" />
// 								<span>Afmelden</span>
// 							</button>
// 						) : (
// 							<button
// 								type="button"
// 								onClick={handleLoginNavigate}
// 								className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20"
// 							>
// 								<LogIn className="h-4 w-4" />
// 								<span>Inloggen</span>
// 							</button>
// 						)}
// 					</div>
// 				</div>
// 			)}
// 		</header>
// 	);
// };

// export default Navbar;

