import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { get, post, postForm } from "../lib/api";

const Planning = () => {
	const [tasks, setTasks] = useState([]);
	const [notes, setNotes] = useState({}); // { [taskId]: text }
	const [evidenceByTask, setEvidenceByTask] = useState({}); // { [taskId]: [evidence] }
	const [modalOpen, setModalOpen] = useState(false);
	const [currentTaskId, setCurrentTaskId] = useState(null);
	const [uploadForm, setUploadForm] = useState({ name: "", type: "", file: null });

	const token = localStorage.getItem("token");

	const loadEvidenceForTask = async (taskId) => {
		if (!token) return;
			try {
				const items = await get(`/taskevidence/by-task/${taskId}`);
				setEvidenceByTask((prev) => ({ ...prev, [taskId]: items || [] }));
			} catch (_) {
			setEvidenceByTask((prev) => ({ ...prev, [taskId]: [] }));
		}
	};

	const loadTasks = async () => {
			try {
				const data = await get("/tasks");
			setTasks(data);

			if (token) {
				// load saved notes and evidence per task
				for (const t of data) {
								try {
									const responseData = await get(`/responses/${t.id}`);
									const noteText = responseData?.notes ?? responseData?.responseText ?? "";
									setNotes((prev) => ({ ...prev, [t.id]: noteText }));
								} catch (_) {}
					await loadEvidenceForTask(t.id);
				}
			}
		} catch (err) {
			setTasks([]);
		}
	};

	useEffect(() => {
		loadTasks();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const saveResponse = async (taskId) => {
			const responseText = notes[taskId] || "";
			try {
				await post(`/responses/${taskId}`, { notes: responseText });
				alert("✅ Response saved/updated!");
			} catch (e) {
				alert("❌ Failed to save response.");
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

	const handleUploadField = (e) => {
		const { name, value, files } = e.target;
		setUploadForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
	};

	const submitUpload = async (e) => {
		e.preventDefault();
		if (!currentTaskId) return;
		const token = localStorage.getItem("token");

		// 1) upload evidence
		const fd = new FormData();
		fd.append("name", uploadForm.name);
		if (uploadForm.type) fd.append("type", uploadForm.type);
		if (uploadForm.file) fd.append("file", uploadForm.file);

			let ev;
			try {
				ev = await postForm("/evidence/upload", fd);
			} catch (_) {
				alert("❌ Upload failed");
				return;
			}

		// 2) assign
			try {
				await post("/taskevidence/assign", { taskId: currentTaskId, evidenceId: ev.id });
			} catch (err) {
				alert("❌ Failed to assign evidence" + (err?.data?.error ? `\n${err.data.error}` : ""));
				return;
			}

		await loadEvidenceForTask(currentTaskId);
		closeUploadModal();
		alert("✅ Evidence uploaded and assigned!");
	};

	return (
		<div>
			<Navbar />
			<div className="content">
				<h1>Planning / Portfolio Steps</h1>
				{tasks.map((task) => (
					<div className="task" key={task.id}>
						<h3>{task.title}</h3>
						<p>{task.description}</p>
						<textarea
							value={notes[task.id] || ""}
							onChange={(e)=>setNotes((prev)=>({...prev, [task.id]: e.target.value}))}
						/>
						<div className="task-actions">
							<button onClick={()=>saveResponse(task.id)}>Save</button>
							<button onClick={()=>openUploadModal(task.id)}>Upload evidence</button>
						</div>
						<div className="task-evidence">
							<strong>Evidence:</strong> { (evidenceByTask[task.id] && evidenceByTask[task.id].length)
								? evidenceByTask[task.id].map((e)=>e.name).join(", ")
								: "None" }
						</div>
						<hr />
					</div>
				))}
			</div>

			{/* Modal */}
			{modalOpen && (
				<div
					style={{
						display: "block",
						position: "fixed",
						inset: 0,
						background: "rgba(0,0,0,0.4)",
					}}
				>
					<div
						style={{
							background: "#fff",
							padding: 16,
							maxWidth: 420,
							margin: "10% auto",
							borderRadius: 6,
						}}
					>
						<h3>Upload Evidence</h3>
						<form onSubmit={submitUpload}>
							<input type="text" name="name" placeholder="Evidence name" required value={uploadForm.name} onChange={handleUploadField} />
							<br /><br />
							<input type="text" name="type" placeholder="Type (e.g. pdf, image)" value={uploadForm.type} onChange={handleUploadField} />
							<br /><br />
							<input type="file" name="file" required onChange={handleUploadField} />
							<br /><br />
							<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
								<button type="button" onClick={closeUploadModal}>Cancel</button>
								<button type="submit">Upload</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};

export default Planning;

