import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { get, post } from "../lib/api";

const Messages = () => {
	const [messages, setMessages] = useState([]);
	const [toUserId, setToUserId] = useState("");
	const [content, setContent] = useState("");

		const loadMessages = async () => {
			const msgs = await get("/messages");
			setMessages(msgs);
		};

	useEffect(() => {
		loadMessages();
	}, []);

	const onSubmit = async (e) => {
		e.preventDefault();
			await post("/messages/send", { toUserId, content });
		setContent("");
		await loadMessages();
	};

	return (
		<div>
			<Navbar />
			<div className="content">
				<div id="messages">
					<h2>Conversation</h2>
					{messages.map((m) => (
						<div key={m.id}>
							<b>{m.fromUser?.name}</b> → <i>{m.toUser?.name}</i>: {m.content}
						</div>
					))}
				</div>

				<h2>Send Message</h2>
				<form onSubmit={onSubmit}>
					<input type="number" placeholder="Recipient User ID" required value={toUserId} onChange={(e)=>setToUserId(e.target.value)} />
					<br />
					<textarea placeholder="Message" value={content} onChange={(e)=>setContent(e.target.value)} />
					<br />
					<button type="submit">Send</button>
				</form>
			</div>
		</div>
	);
};

export default Messages;

