import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../lib/api";
import LegacyPageLayout from "./LegacyPageLayout";
import LoadingSpinner from "../components/LoadingSpinner";

// React version of Frontend/Dashboard.html
// - Loads current user via /auth/me using token from localStorage
// - Redirects to Login if missing/invalid token
// - Displays user's name/email and role

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const data = await get("/auth/me");
        setUser(data);
      } catch (err) {
        console.error("Failed to load user:", err);
        localStorage.removeItem("token");
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <LegacyPageLayout title="Dashboard" description="Een moment geduld alsjeblieft… we laden je gegevens." kicker="Welkom terug">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner label="Profiel laden" />
        </div>
      </LegacyPageLayout>
    );
  }

  return (
    <LegacyPageLayout
      kicker="Welkom terug"
      title={`Hallo ${user?.name || user?.email}!`}
      description="Dit is je persoonlijke startpunt. Beheer je portfolio, volg je planning en blijf in contact met je coach."
      actions={[
        <button
          key="logout"
          type="button"
          onClick={logout}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600"
        >
          Afmelden
        </button>,
      ]}
    >
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Jouw gegevens</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-500">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-600">Naam</dt>
              <dd className="text-slate-900">{user?.name || "-"}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-600">E-mail</dt>
              <dd className="text-slate-900">{user?.email}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-600">Rol</dt>
              <dd className="text-slate-900 capitalize">{user?.role}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-600">Lid sinds</dt>
              <dd className="text-slate-900">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Wat kun je hier doen?</h2>
            <p className="mt-3 text-sm text-slate-500">
              Gebruik de navigatie om snel naar je planning, bewijsstukken of berichten te springen. Elk onderdeel is ontworpen om je EVC-traject helder en haalbaar te maken.
            </p>
          </div>
          <div className="mt-6 grid gap-4">
            <button
              type="button"
              onClick={() => navigate("/planning")}
              className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-left text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              Naar mijn planning
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/evidence")}
              className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Bewijsstukken beheren
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      </section>
    </LegacyPageLayout>
  );
};

export default Dashboard;
