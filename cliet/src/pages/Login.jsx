import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { post } from "../lib/api";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import LegacyPageLayout from "./LegacyPageLayout";

const Login = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();

	const onSubmit = async (event) => {
		event.preventDefault();
		setLoading(true);
		setError("");
		try {
			// Sign in with Firebase Auth (works with emulator in development)
			const cred = await signInWithEmailAndPassword(auth, email, password);
			const idToken = await cred.user.getIdToken();
			// Exchange Firebase ID token for API JWT (Firestore-backed backend)
			const data = await post("/auth/login/firebase", { idToken });
			if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
			// We rely solely on Firebase ID tokens for API Authorization; no JWT stored.
			const redirectPath = data.redirectPath || "/dashboard";
			navigate(redirectPath, { replace: true });
		} catch (err) {
			setError(err?.data?.error || err?.message || "Inloggen is niet gelukt. Controleer je gegevens.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<LegacyPageLayout
			kicker="Inloggen"
			title="Welkom terug bij EVC"
			description="Log in om je traject te volgen, bewijsstukken te uploaden en contact te houden met je begeleider. Nieuwe accounts worden door een beheerder aangemaakt."
		>
			<section className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
						<LogIn className="h-5 w-5" />
					</div>
					<div>
						<h2 className="text-xl font-semibold text-slate-900">Log in op je account</h2>
						<p className="text-sm text-slate-500">Gebruik het e-mailadres waarmee je bent aangemeld voor het traject.</p>
					</div>
				</div>

				<form onSubmit={onSubmit} className="mt-6 space-y-5">
					{error ? (
						<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{error}
						</div>
					) : null}
					<div className="grid gap-2">
						<label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
							E-mail
						</label>
						<input
							id="login-email"
							type="email"
							placeholder="jij@voorbeeld.nl"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
							required
						/>
					</div>
					<div className="grid gap-2">
						<label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
							Wachtwoord
						</label>
						<input
							id="login-password"
							type="password"
							placeholder="Vul je wachtwoord in"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
							required
						/>
					</div>
					<div className="flex items-center justify-between text-sm">
						<label className="flex items-center gap-2 text-slate-600">
							<input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
							<span>Onthoud mij</span>
						</label>
						<button
							type="button"
							onClick={() => alert("Neem contact op met het supportteam om je wachtwoord te resetten.")}
							className="font-medium text-brand-600 transition hover:text-brand-500"
						>
							Wachtwoord vergeten?
						</button>
					</div>
					<button
						type="submit"
						disabled={loading}
						className="mt-4 w-full rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
					>
						{loading ? "Bezig met inloggen..." : "Inloggen"}
					</button>
				</form>

				<p className="mt-6 text-center text-sm text-slate-500">
					Hulp nodig? Neem contact op met het EVC-team.
				</p>
			</section>
		</LegacyPageLayout>
	);
};

export default Login;

