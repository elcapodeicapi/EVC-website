import React, { useState } from "react";
import Navbar from "./Navbar";
import { post } from "../lib/api";

const Register = () => {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [role, setRole] = useState("user");
	const [loading, setLoading] = useState(false);

	const onSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
					const data = await post("/auth/register", { name, email, password, role });
			if (data.error) {
				alert("❌ Error: " + data.error);
			} else if (data.token) {
				localStorage.setItem("token", data.token);
				localStorage.setItem("user", JSON.stringify(data.user));
			window.location.href = "/dashboard";
			} else {
				alert("Registration failed");
			}
		} catch (err) {
			alert("Registration failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<Navbar />
			<div className="content">
				<h1>Register</h1>
				<form onSubmit={onSubmit}>
					<input type="text" placeholder="Full name" value={name} onChange={(e)=>setName(e.target.value)} />
					<br />
					<input type="email" placeholder="Email" required value={email} onChange={(e)=>setEmail(e.target.value)} />
					<br />
					<input type="password" placeholder="Password" required value={password} onChange={(e)=>setPassword(e.target.value)} />
					<br />
					<label htmlFor="role">Role:&nbsp;</label>
					<select id="role" value={role} onChange={(e)=>setRole(e.target.value)}>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
					<br /><br />
					<button type="submit" disabled={loading}>{loading?"Registering...":"Register"}</button>
				</form>
			</div>
		</div>
	);
};

export default Register;

