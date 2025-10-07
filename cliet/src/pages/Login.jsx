import React, { useState } from "react";
import Navbar from "./Navbar";
import { post } from "../lib/api";

const Login = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const onSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
					const data = await post("/auth/login", { email, password });
			if (data.token) {
				localStorage.setItem("token", data.token);
				alert("Logged in as " + data.user.role);
			window.location.href = "/dashboard";
			} else {
				alert(data.error || "Login failed");
			}
		} catch (err) {
			alert("Login failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<Navbar />
			<div className="content">
				<h1>Login</h1>
				<form onSubmit={onSubmit}>
					<input type="email" placeholder="Email" required value={email} onChange={(e)=>setEmail(e.target.value)} />
					<br />
					<input type="password" placeholder="Password" required value={password} onChange={(e)=>setPassword(e.target.value)} />
					<br />
					<button type="submit" disabled={loading}>{loading?"Logging in...":"Login"}</button>
				</form>
			</div>
		</div>
	);
};

export default Login;

