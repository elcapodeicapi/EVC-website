import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { get } from "../lib/api";

const Profile = () => {
	const [user, setUser] = useState(null);
	const [error, setError] = useState("");

	useEffect(() => {
		const loadProfile = async () => {
			const token = localStorage.getItem("token");
			if (!token) {
				setError("⚠️ Not logged in");
				return;
			}
					try {
						const data = await get("/auth/me");
				setUser(data);
			} catch (err) {
				setError("❌ Failed to load profile");
			}
		};
		loadProfile();
	}, []);

	return (
		<div>
			<Navbar />
			<div className="content">
				<h1>My Profile</h1>
				{error && <div>{error}</div>}
				{user && (
					<div>
						<p><b>Name:</b> {user.name || "-"}</p>
						<p><b>Email:</b> {user.email}</p>
						<p><b>Role:</b> {user.role}</p>
						<p><b>Member since:</b> {new Date(user.createdAt).toLocaleDateString()}</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default Profile;

