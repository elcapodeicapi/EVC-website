import React, { useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";
import { get, post, postForm } from "../lib/api";
import LegacyPageLayout from "./LegacyPageLayout";
import LoadingSpinner from "../components/LoadingSpinner";

const Planning = () => {
	const [tasks, setTasks] = useState([]);
	const [notes, setNotes] = useState({}); // { [taskId]: text }
	const [evidenceByTask, setEvidenceByTask] = useState({}); // { [taskId]: [evidence] }
	const [modalOpen, setModalOpen] = useState(false);
	const [currentTaskId, setCurrentTaskId] = useState(null);
	const [uploadForm, setUploadForm] = useState({ name: "", type: "", file: null });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const loadEvidenceForTask = async (taskId) => {
		const token = localStorage.getItem("token");
		if (!token) return;

		try {
			const items = await get(`/taskevidence/by-task/${taskId}`);
			setEvidenceByTask((prev) => ({ ...prev, [taskId]: items || [] }));
		} catch (_) {
			setEvidenceByTask((prev) => ({ ...prev, [taskId]: [] }));
		}
	};

	const loadTasks = async () => {
		setLoading(true);
		setError("");
		try {
			const data = await get("/tasks");
			setTasks(data);

			const token = localStorage.getItem("token");
			if (token) {
				const results = await Promise.all(
					data.map(async (task) => {
						let noteText = "";
						try {
							const responseData = await get(`/responses/${task.id}`);
							noteText = responseData?.notes ?? responseData?.responseText ?? "";
						} catch (_) {}

						let evidenceItems = [];
						try {
							evidenceItems = await get(`/taskevidence/by-task/${task.id}`);
						} catch (_) {}

						return { taskId: task.id, noteText, evidenceItems: evidenceItems || [] };
					})
				);

				setNotes(
					results.reduce((acc, item) => {
						acc[item.taskId] = item.noteText;
						return acc;
					}, {})
				);

				setEvidenceByTask(
					results.reduce((acc, item) => {
						acc[item.taskId] = item.evidenceItems;
						return acc;
					}, {})
				);
			}
		} catch (err) {
			console.error("Failed to load tasks", err);
			setError("We konden de planning niet laden. Probeer het later opnieuw.");
			setTasks([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadTasks();
	}, []);

	const saveResponse = async (taskId) => {
		const responseText = notes[taskId] || "";
		try {
			await post(`/responses/${taskId}`, { notes: responseText });
			alert("✅ Antwoord opgeslagen!");
		} catch (e) {
			alert("❌ Opslaan mislukt. Probeer het opnieuw.");
		}
	};

	const openUploadModal = (taskId) => {
		setCurrentTaskId(taskId);
		setUploadForm({ name: "", type: "", file: null });
		setModalOpen(true);
	};
	const closeUploadModal = () => {
		setModalOpen(false);
		setCurrentTaskId(null);
	};

	const handleUploadField = (event) => {
		const { name, value, files } = event.target;
		setUploadForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
	};

	const submitUpload = async (event) => {
		event.preventDefault();
		if (!currentTaskId) return;

		const fd = new FormData();
		fd.append("name", uploadForm.name);
		if (uploadForm.type) fd.append("type", uploadForm.type);
		if (uploadForm.file) fd.append("file", uploadForm.file);

		let evidence;
		try {
			evidence = await postForm("/evidence/upload", fd);
		} catch (error) {
			const message = error?.data?.error || error?.message || "Upload mislukt";
			alert("❌ Upload mislukt\n" + message);
			return;
		}

		try {
			await post("/taskevidence/assign", { taskId: currentTaskId, evidenceId: evidence.id });
		} catch (err) {
			alert("❌ Koppelen mislukt" + (err?.data?.error ? `\n${err.data.error}` : ""));
			return;
		}

		await loadEvidenceForTask(currentTaskId);
		closeUploadModal();
		alert("✅ Evidence gekoppeld aan taak!");
	};

	return (
		<LegacyPageLayout
			kicker="Planning"
			title="Portfolio stappen"
			description="Noteer je voortgang, upload bewijsstukken en houd overzicht per taak."
			actions={[
				<button
					key="refresh"
					type="button"
					onClick={loadTasks}
					className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600"
				>
					Ververs
				</button>,
			]}
		>
			{loading ? (
				<div className="flex items-center justify-center py-20">
					<LoadingSpinner label="Planning laden" />
				</div>
			) : null}

			{!loading && error ? (
				<div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600">
					{error}
				</div>
			) : null}

			{!loading && !error && tasks.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
					Er zijn nog geen taken beschikbaar. Zodra je coach taken toevoegt, verschijnen ze hier automatisch.
				</div>
			) : null}

			{!loading && !error && tasks.length > 0 ? (
				<div className="space-y-6">
					{tasks.map((task) => {
						const evidence = evidenceByTask[task.id] || [];
						return (
							<article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
								<header className="flex flex-wrap items-start justify-between gap-4">
									<div>
										<h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
										<p className="mt-1 text-sm text-slate-500">{task.description}</p>
									</div>
									<button
										type="button"
										onClick={() => openUploadModal(task.id)}
										className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
									>
										<UploadCloud className="h-4 w-4" />
										Upload bewijs
									</button>
								</header>

								<label className="mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
									Reflectie / notities
								</label>
								<textarea
									value={notes[task.id] || ""}
									onChange={(event) => setNotes((prev) => ({ ...prev, [task.id]: event.target.value }))}
									placeholder="Schrijf hier je reflectie of bewijstoelichting..."
									className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
									rows={4}
								/>

								<div className="mt-4 flex flex-wrap gap-3">
									<button
										type="button"
										onClick={() => saveResponse(task.id)}
										className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
									>
										Opslaan
									</button>
									<button
										type="button"
										onClick={() => setNotes((prev) => ({ ...prev, [task.id]: "" }))}
										className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600"
									>
										Leegmaken
									</button>
								</div>

								<div className="mt-6">
									<h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Bewijsstukken</h4>
									{evidence.length > 0 ? (
										<ul className="mt-3 flex flex-wrap gap-2">
											{evidence.map((item) => (
												<li
													key={item.id}
													className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
												>
													<span>{item.name}</span>
													<span className="text-brand-400">({item.type || "bestand"})</span>
												</li>
											))}
										</ul>
									) : (
										<p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
											Nog geen bewijs toegevoegd. Voeg bestanden toe om je reflectie te ondersteunen.
										</p>
									)}
								</div>
							</article>
						);
					})}
				</div>
			) : null}

			{modalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
					<div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h3 className="text-lg font-semibold text-slate-900">Upload bewijsstuk</h3>
								<p className="mt-1 text-sm text-slate-500">
									Koppel een bestand aan deze taak. Bestanden worden veilig opgeslagen.
								</p>
							</div>
							<button
								type="button"
								onClick={closeUploadModal}
								className="text-sm font-medium text-slate-400 transition hover:text-slate-600"
							>
								Sluiten
							</button>
						</div>
						<form onSubmit={submitUpload} className="mt-6 space-y-4">
							<div className="grid gap-2">
								<label htmlFor="evidence-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
									Naam
								</label>
								<input
									id="evidence-name"
									type="text"
									name="name"
									value={uploadForm.name}
									onChange={handleUploadField}
									required
									className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
								/>
							</div>
							<div className="grid gap-2">
								<label htmlFor="evidence-type" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
									Type
								</label>
								<input
									id="evidence-type"
									type="text"
									name="type"
									placeholder="bijvoorbeeld PDF, Foto"
									value={uploadForm.type}
									onChange={handleUploadField}
									className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
								/>
							</div>
							<div className="grid gap-2">
								<label htmlFor="evidence-file" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
									Bestand
								</label>
								<input
									id="evidence-file"
									type="file"
									name="file"
									required
									onChange={handleUploadField}
									className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
								/>
							</div>
							<div className="flex justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={closeUploadModal}
									className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600"
								>
									Annuleren
								</button>
								<button
									type="submit"
									className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
								>
									Uploaden
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}
		</LegacyPageLayout>
	);
};

export default Planning;

