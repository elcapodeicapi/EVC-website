import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { get } from "../lib/api";

// React version of Frontend/Dashboard.html
// - Loads current user via /auth/me using token from localStorage
// - Redirects to Login if missing/invalid token
// - Displays user's name/email and role

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("⚠️ You must log in first");
        window.location.href = "/login";
        return;
      }

      try {
        try {
          const data = await get("/auth/me");
          setUser(data);
        } catch (err) {
          alert("⚠️ Session expired or invalid. Please log in again.");
          localStorage.removeItem("token");
          window.location.href = "/login";
          return;
        }
      } catch (err) {
        console.error("Failed to load user:", err);
        alert("Failed to load user information. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  if (loading) {
    return <div className="content">Loading...</div>;
  }

  return (
    <div>
      <Navbar />
      <div className="content">
        <h1>
          Welcome, <span id="userName">{user?.name || user?.email}</span> 👋
        </h1>
        <p>
          Your role: <span id="userRole">{user?.role}</span>
        </p>

        <button onClick={logout}>Logout</button>
      </div>
    </div>
  );
};

export default Dashboard;
