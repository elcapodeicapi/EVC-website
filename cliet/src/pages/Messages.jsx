import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { get, post } from "../lib/api";
import LegacyPageLayout from "./LegacyPageLayout";
import LoadingSpinner from "../components/LoadingSpinner";

const Messages = () => {
	const [messages, setMessages] = useState([]);
	const [toUserId, setToUserId] = useState("");
	const [content, setContent] = useState("");
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState("");

	const loadMessages = async () => {
		setLoading(true);
		setError("");
		try {
			const msgs = await get("/messages");
			setMessages(msgs || []);
		} catch (err) {
			console.error("Failed to load messages", err);
			setError("We konden de berichten niet ophalen. Probeer het later opnieuw.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadMessages();
	}, []);

	const onSubmit = async (event) => {
		event.preventDefault();
		setSending(true);
		try {
			await post("/messages/send", { toUserId, content });
			setContent("");
			await loadMessages();
		} catch (err) {
			alert("❌ Verzenden mislukt. Probeer het opnieuw.");
		} finally {
			setSending(false);
		}
	};

	return (
		<LegacyPageLayout
			kicker="Berichten"
			title="Communiceer met je coach"
			description="Stuur snel een bericht en bekijk het volledige gespreksoverzicht."
			actions={[
				<button
					key="refresh"
					type="button"
					onClick={loadMessages}
					className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600"
				>
					Ververs
				</button>,
			]}
		>
			{loading ? (
				<div className="flex items-center justify-center py-20">
					<LoadingSpinner label="Berichten laden" />
				</div>
			) : null}

			{!loading && error ? (
				<div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">{error}</div>
			) : null}

			{!loading && !error ? (
				<div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
					<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
								<MessageCircle className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-semibold text-slate-900">Gespreksarchief</h2>
								<p className="text-sm text-slate-500">Je meest recente berichten met coaches en kandidaten.</p>
							</div>
						</div>
						{messages.length > 0 ? (
							<ul className="mt-6 space-y-3 text-sm text-slate-600">
								{messages.map((m) => (
									<li key={m.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
										<div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
											<span>Van {m.fromUser?.name || "Onbekend"}</span>
											<span>→</span>
											<span>Naar {m.toUser?.name || m.toUserId}</span>
											{m.createdAt ? (
												<span className="font-medium text-slate-500">
													{new Date(m.createdAt).toLocaleString()}
												</span>
											) : null}
										</div>
										<p className="mt-2 text-base text-slate-700">{m.content}</p>
									</li>
								))}
							</ul>
						) : (
							<p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
								Nog geen berichten verzonden of ontvangen.
							</p>
						)}
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<h2 className="text-lg font-semibold text-slate-900">Nieuw bericht</h2>
						<p className="mt-1 text-sm text-slate-500">Vul het gebruikersnummer en je bericht in om contact op te nemen.</p>
						<form onSubmit={onSubmit} className="mt-6 space-y-4">
							<div className="grid gap-2">
								<label htmlFor="message-to" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
									Ontvanger ID
								</label>
								<input
									id="message-to"
									type="number"
									required
									value={toUserId}
									onChange={(event) => setToUserId(event.target.value)}
									className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
								/>
							</div>
							<div className="grid gap-2">
								<label htmlFor="message-content" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
									Bericht
								</label>
								<textarea
									id="message-content"
									required
									value={content}
									onChange={(event) => setContent(event.target.value)}
									rows={5}
									className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
									placeholder="Schrijf je bericht..."
								/>
							</div>
							<div className="flex justify-end gap-3 pt-2">
								<button
									type="submit"
									disabled={sending}
									className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
								>
									{sending ? "Verzenden..." : "Versturen"}
								</button>
							</div>
						</form>
					</section>
				</div>
			) : null}
		</LegacyPageLayout>
	);
};

export default Messages;

