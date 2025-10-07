import React from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
	const logout = () => {
		localStorage.removeItem("token");
		// Adjust to your router path if needed
		window.location.href = "/Login.html";
	};

		return (
			<nav className="main-navbar">
				<div className="logo">EVC Tool</div>
				<ul>
					<li><Link to="/dashboard">Dashboard</Link></li>
					<li><Link to="/profile">Profile</Link></li>
					<li><Link to="/planning">Planning</Link></li>
					<li><Link to="/evidence">Evidence</Link></li>
					<li><Link to="/messages">Messages</Link></li>
					<li><a href="#" onClick={logout}>Logout</a></li>
				</ul>
			</nav>
		);
};

export default Navbar;

