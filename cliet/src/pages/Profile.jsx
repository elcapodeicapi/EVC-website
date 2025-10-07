import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../lib/api";
import LegacyPageLayout from "./LegacyPageLayout";
import LoadingSpinner from "../components/LoadingSpinner";

const Profile = () => {
	const [user, setUser] = useState(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const navigate = useNavigate();

	useEffect(() => {
		const loadProfile = async () => {
			const token = localStorage.getItem("token");
			if (!token) {
				setError("Je bent niet ingelogd. Log in om je profiel te bekijken.");
				setLoading(false);
				return;
			}
			try {
				const data = await get("/auth/me");
				setUser(data);
			} catch (err) {
				console.error("Failed to load profile", err);
				setError("We konden je profiel niet ophalen. Probeer het later nog eens.");
			} finally {
				setLoading(false);
			}
		};
		loadProfile();
	}, []);

	if (loading) {
		return (
			<LegacyPageLayout title="Profiel" description="Een moment geduld, we laden je gegevens." kicker="Account">
				<div className="flex items-center justify-center py-20">
					<LoadingSpinner label="Profiel laden" />
				</div>
			</LegacyPageLayout>
		);
	}

	if (error && !user) {
		return (
			<LegacyPageLayout
				kicker="Profiel"
				title="Meld je eerst aan"
				description={error}
				actions={[
					<button
						key="login"
						type="button"
						onClick={() => navigate("/login")}
						className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
					>
						Naar login
					</button>,
				]}
			>
				<div className="rounded-2xl border border-dashed border-brand-200 bg-white/60 p-10 text-center text-sm text-slate-500">
					Je profielgegevens worden zichtbaar zodra je bent aangemeld.
				</div>
			</LegacyPageLayout>
		);
	}

	return (
		<LegacyPageLayout
			kicker="Profiel"
			title="Jouw gegevens"
			description="Overzicht van je accountinformatie binnen het EVC platform."
		>
			<section className="grid gap-6 lg:grid-cols-2">
				<article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Persoonsgegevens</h2>
					<dl className="mt-6 space-y-4 text-sm text-slate-500">
						<div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
							<dt className="font-medium text-slate-600">Naam</dt>
							<dd className="text-slate-900">{user?.name || "-"}</dd>
						</div>
						<div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
							<dt className="font-medium text-slate-600">E-mail</dt>
							<dd className="text-slate-900">{user?.email}</dd>
						</div>
						<div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
							<dt className="font-medium text-slate-600">Rol</dt>
							<dd className="text-slate-900 capitalize">{user?.role}</dd>
						</div>
						<div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
							<dt className="font-medium text-slate-600">Lid sinds</dt>
							<dd className="text-slate-900">
								{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
							</dd>
						</div>
					</dl>
				</article>
				<article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Beveiliging & toegang</h2>
					<p className="mt-3 text-sm text-slate-500">
						Wil je je gegevens wijzigen of een nieuw wachtwoord instellen? Neem contact op met je coach of beheerder. Binnenkort voegen we hier zelfservice opties toe.
					</p>
					<button
						type="button"
						onClick={() => navigate("/messages")}
						className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
					>
						Stuur bericht naar coach
					</button>
				</article>
			</section>
		</LegacyPageLayout>
	);
};

export default Profile;

