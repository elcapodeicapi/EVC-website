// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { LogIn } from "lucide-react";
// import { post } from "../lib/api";
// import { auth } from "../firebase";
// import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
// import LegacyPageLayout from "./LegacyPageLayout";

// const Login = () => {
// 	const [email, setEmail] = useState("");
// 	const [password, setPassword] = useState("");
// 	const [loading, setLoading] = useState(false);
// 	const [error, setError] = useState("");
// 	const [showReset, setShowReset] = useState(false);
// 	const [resetEmail, setResetEmail] = useState("");
// 	const [resetLoading, setResetLoading] = useState(false);
// 	const [resetError, setResetError] = useState("");
// 	const [resetSuccess, setResetSuccess] = useState("");
// 	const navigate = useNavigate();

// 	const onSubmit = async (event) => {
// 		event.preventDefault();
// 		setLoading(true);
// 		setError("");
// 		try {
// 			// Sign in with Firebase Auth (works with emulator in development)
// 			const cred = await signInWithEmailAndPassword(auth, email, password);
// 			const idToken = await cred.user.getIdToken();
// 			// Exchange Firebase ID token for API JWT (Firestore-backed backend)
// 			const data = await post("/auth/login/firebase", { idToken });
// 			if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
// 			// We rely solely on Firebase ID tokens for API Authorization; no JWT stored.
// 			const redirectPath = data.redirectPath || "/dashboard";
// 			navigate(redirectPath, { replace: true });
// 		} catch (err) {
// 			setError(err?.data?.error || err?.message || "Inloggen is niet gelukt. Controleer je gegevens.");
// 		} finally {
// 			setLoading(false);
// 		}
// 	};

// 	const toggleReset = () => {
// 		setShowReset((prev) => {
// 			const next = !prev;
// 			if (next) {
// 				setResetEmail((val) => val || email);
// 				setResetError("");
// 				setResetSuccess("");
// 			}
// 			return next;
// 		});
// 	};

// 	const handleSendReset = async (event) => {
// 		event.preventDefault();
// 		setResetError("");
// 		setResetSuccess("");
// 		const targetEmail = (resetEmail || email || "").trim();
// 		if (!targetEmail) {
// 			setResetError("Vul een geldig e-mailadres in.");
// 			return;
// 		}
// 		setResetLoading(true);
// 		try {
// 			await sendPasswordResetEmail(auth, targetEmail);
// 			setResetSuccess("Er is een e-mail verzonden met instructies om je wachtwoord te herstellen.");
// 		} catch (err) {
// 			const code = err?.code || "";
// 			let msg = err?.message || "Het verzenden van de reset e-mail is mislukt.";
// 			if (code === "auth/invalid-email") msg = "Het e-mailadres is ongeldig.";
// 			else if (code === "auth/user-not-found") msg = "Er is geen account gevonden met dit e-mailadres.";
// 			setResetError(msg);
// 		} finally {
// 			setResetLoading(false);
// 		}
// 	};

// 	return (
// 		<LegacyPageLayout
// 			kicker="Inloggen"
// 			title="Welkom terug bij EVC"
// 			description="Log in om je traject te volgen, bewijsstukken te uploaden en contact te houden met je begeleider. Nieuwe accounts worden door een beheerder aangemaakt."
// 		>
// 			<section className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
// 				<div className="flex items-center gap-3">
// 					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
// 						<LogIn className="h-5 w-5" />
// 					</div>
// 					<div>
// 						<h2 className="text-xl font-semibold text-slate-900">Log in op je account</h2>
// 						<p className="text-sm text-slate-500">Gebruik het e-mailadres waarmee je bent aangemeld voor het traject.</p>
// 					</div>
// 				</div>

// 				<form onSubmit={onSubmit} className="mt-6 space-y-5">
// 					{error ? (
// 						<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
// 							{error}
// 						</div>
// 					) : null}
// 					<div className="grid gap-2">
// 						<label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
// 							E-mail
// 						</label>
// 						<input
// 							id="login-email"
// 							type="email"
// 							placeholder="jij@voorbeeld.nl"
// 							value={email}
// 							onChange={(event) => setEmail(event.target.value)}
// 							className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
// 							required
// 						/>
// 					</div>
// 					<div className="grid gap-2">
// 						<label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
// 							Wachtwoord
// 						</label>
// 						<input
// 							id="login-password"
// 							type="password"
// 							placeholder="Vul je wachtwoord in"
// 							value={password}
// 							onChange={(event) => setPassword(event.target.value)}
// 							className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
// 							required
// 						/>
// 					</div>
// 					<div className="flex items-center justify-between text-sm">
// 						<label className="flex items-center gap-2 text-slate-600">
// 							<input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
// 							<span>Onthoud mij</span>
// 						</label>
// 						<button
// 							type="button"
// 							onClick={toggleReset}
// 							className="font-medium text-brand-600 transition hover:text-brand-500"
// 						>
// 							Wachtwoord vergeten?
// 						</button>
// 					</div>

// 						{showReset ? (
// 							<div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
// 								<form onSubmit={handleSendReset} className="space-y-3">
// 									{resetError ? (
// 										<div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{resetError}</div>
// 									) : null}
// 									{resetSuccess ? (
// 										<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{resetSuccess}</div>
// 									) : null}
// 									<div className="grid gap-1.5">
// 										<label htmlFor="reset-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
// 											E-mailadres voor herstel
// 										</label>
// 										<input
// 											id="reset-email"
// 											type="email"
// 											placeholder="jij@voorbeeld.nl"
// 											value={resetEmail}
// 											onChange={(e) => setResetEmail(e.target.value)}
// 											className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
// 											required
// 										/>
// 									</div>
// 									<div className="flex items-center justify-end gap-2">
// 										<button
// 											type="button"
// 											onClick={() => setShowReset(false)}
// 											className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
// 										>
// 											Annuleren
// 										</button>
// 										<button
// 											type="submit"
// 											disabled={resetLoading}
// 											className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
// 										>
// 											{resetLoading ? "Versturen..." : "Stuur herstel e-mail"}
// 										</button>
// 									</div>
// 								</form>
// 							</div>
// 						) : null}
// 					<button
// 						type="submit"
// 						disabled={loading}
// 						className="mt-4 w-full rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
// 					>
// 						{loading ? "Bezig met inloggen..." : "Inloggen"}
// 					</button>
// 				</form>

// 				<p className="mt-6 text-center text-sm text-slate-500">
// 					Hulp nodig? Neem contact op met het EVC-team.
// 				</p>
// 			</section>
// 		</LegacyPageLayout>
// 	);
// };

// export default Login;

