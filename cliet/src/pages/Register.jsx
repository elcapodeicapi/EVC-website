import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { post } from "../lib/api";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import LegacyPageLayout from "./LegacyPageLayout";

const Register = () => {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [role, setRole] = useState("user");
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const onSubmit = async (event) => {
		event.preventDefault();
		setLoading(true);
			try {
				// Create Firebase user (supports emulator in dev)
				const cred = await createUserWithEmailAndPassword(auth, email, password);
				if (name) {
					try { await updateProfile(cred.user, { displayName: name }); } catch (_) { /* noop */ }
				}
				const idToken = await cred.user.getIdToken();
				// Exchange for API JWT and SQL mirroring
				const data = await post("/auth/register/firebase", { idToken, role, name });
				if (data?.token) {
					localStorage.setItem("token", data.token);
					if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
					const redirectPath = data.redirectPath || "/dashboard";
					navigate(redirectPath, { replace: true });
					return;
				}
				// Fallback to legacy register if exchange fails
				const legacy = await post("/auth/register", { name, email, password, role });
				if (legacy?.token) {
					localStorage.setItem("token", legacy.token);
					if (legacy.user) localStorage.setItem("user", JSON.stringify(legacy.user));
					const redirectPath = legacy.redirectPath || "/dashboard";
					navigate(redirectPath, { replace: true });
					return;
				}
				alert(data?.error || legacy?.error || "Registratie mislukt");
			} catch (err) {
				alert("Registratie mislukt");
			} finally {
				setLoading(false);
			}
	};

	return (
		<LegacyPageLayout
			kicker="Aanmelden"
			title="Maak een nieuw account"
			description="Start met het opbouwen van je EVC-portfolio. Vul je gegevens in en ontvang meteen toegang."
			actions={[
				<Link
					key="login"
					to="/login"
					className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600"
				>
					Naar login
				</Link>,
			]}
		>
			<section className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
						<UserPlus className="h-5 w-5" />
					</div>
					<div>
						<h2 className="text-xl font-semibold text-slate-900">Persoonlijke gegevens</h2>
						<p className="text-sm text-slate-500">Alle velden zijn verplicht om je account te activeren.</p>
					</div>
				</div>
				<form onSubmit={onSubmit} className="mt-6 space-y-5">
					<div className="grid gap-2">
						<label htmlFor="register-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
							Volledige naam
						</label>
						<input
							id="register-name"
							type="text"
							placeholder="Bijvoorbeeld: Kim de Vries"
							value={name}
							onChange={(event) => setName(event.target.value)}
							className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
							required
						/>
					</div>
					<div className="grid gap-2">
						<label htmlFor="register-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
							E-mail
						</label>
						<input
							id="register-email"
							type="email"
							placeholder="jij@voorbeeld.nl"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
							required
						/>
					</div>
					<div className="grid gap-2">
						<label htmlFor="register-password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
							Wachtwoord
						</label>
						<input
							id="register-password"
							type="password"
							placeholder="Minimaal 8 tekens"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
							required
						/>
					</div>
					<div className="grid gap-2">
						<label htmlFor="register-role" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
							Rol
						</label>
						<select
							id="register-role"
							value={role}
							onChange={(event) => setRole(event.target.value)}
							className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
						>
							<option value="user">Deelnemer</option>
							<option value="admin">Beheerder</option>
						</select>
					</div>
					<button
						type="submit"
						disabled={loading}
						className="mt-4 w-full rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
					>
						{loading ? "Bezig..." : "Account aanmaken"}
					</button>
				</form>
				<p className="mt-6 text-center text-sm text-slate-500">
					Heb je al een account?{" "}
					<Link to="/login" className="font-semibold text-brand-600 hover:text-brand-500">
						Log dan hier in
					</Link>
					.
				</p>
			</section>
		</LegacyPageLayout>
	);
};

export default Register;

