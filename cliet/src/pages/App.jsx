import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import Login from "./Login";
import Register from "./Register";
import Profile from "./Profile";
import Planning from "./Planning";
import Messages from "./Messages";
import Evidence from "./Evidence";
import Home from "./Home";

const App = () => {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/login" element={<Login />} />
				<Route path="/register" element={<Register />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path="/profile" element={<Profile />} />
				<Route path="/planning" element={<Planning />} />
				<Route path="/messages" element={<Messages />} />
				<Route path="/evidence" element={<Evidence />} />
				{/* Backward-compat: old .html paths */}
				<Route path="/Login.html" element={<Navigate to="/login" replace />} />
				<Route path="/Register.html" element={<Navigate to="/register" replace />} />
				<Route path="/Dashboard.html" element={<Navigate to="/dashboard" replace />} />
				<Route path="/Profile.html" element={<Navigate to="/profile" replace />} />
				<Route path="/Planning.html" element={<Navigate to="/planning" replace />} />
				<Route path="/Messages.html" element={<Navigate to="/messages" replace />} />
				<Route path="/Evidence.html" element={<Navigate to="/evidence" replace />} />
				<Route path="/index.html" element={<Navigate to="/" replace />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
};

export default App;

