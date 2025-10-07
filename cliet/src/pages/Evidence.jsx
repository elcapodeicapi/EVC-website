import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { get, post, postForm } from "../lib/api";

const Evidence = () => {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", type: "", file: null });
  const [assign, setAssign] = useState({ taskId: "", evidenceId: "" });

  const loadEvidence = async () => {
    const evidence = await get("/evidence");
    setList(evidence);
  };

  useEffect(() => {
    loadEvidence();
  }, []);

  const onUploadChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const onUpload = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("type", form.type);
    if (form.file) fd.append("file", form.file);

    try {
      await postForm("/evidence/upload", fd);
      alert("✅ Evidence uploaded!");
      setForm({ name: "", type: "", file: null });
      await loadEvidence();
    } catch (e) {
      alert("❌ Upload failed");
    }
  };

  const onAssignChange = (e) => {
    const { name, value } = e.target;
    setAssign((prev) => ({ ...prev, [name]: value }));
  };

  const onAssign = async (e) => {
    e.preventDefault();
    try {
      await post("/taskevidence/assign", assign);
      alert("✅ Evidence assigned to task!");
    } catch (err) {
      alert("❌ Failed to assign evidence" + (err?.data?.error ? `\n${err.data.error}` : ""));
    }
  };

  return (
    <div>
      <Navbar />
      <div className="content">
        <h2>Upload Evidence</h2>
        <form onSubmit={onUpload}>
          <input type="text" name="name" placeholder="Evidence name" required value={form.name} onChange={onUploadChange} />
          <input type="text" name="type" placeholder="Type (e.g. pdf, image)" required value={form.type} onChange={onUploadChange} />
          <input type="file" name="file" required onChange={onUploadChange} />
          <button type="submit">Upload</button>
        </form>

        <h2>Uploaded Evidence</h2>
        <ul>
          {list.map((ev) => (
            <li key={ev.id}>{ev.name} ({ev.type})</li>
          ))}
        </ul>

        <h2>Assign Evidence to Task</h2>
        <form onSubmit={onAssign}>
          <input type="number" name="taskId" placeholder="Task ID" required value={assign.taskId} onChange={onAssignChange} />
          <input type="number" name="evidenceId" placeholder="Evidence ID" required value={assign.evidenceId} onChange={onAssignChange} />
          <button type="submit">Assign</button>
        </form>
      </div>
    </div>
  );
};

export default Evidence;
