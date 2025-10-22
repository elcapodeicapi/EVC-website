import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeUsers } from "../../lib/firestoreAdmin";
import { post } from "../../lib/api";
import { auth } from "../../firebase";
import { signInWithCustomToken } from "firebase/auth";

const ROLE_LABELS = new Map([
  ["customer", "Kandidaat"],
  ["user", "Kandidaat"],
  ["coach", "Begeleider"],
  ["kwaliteitscoordinator", "Kwaliteitscoordinator"],
  ["assessor", "Assessor"],
  ["admin", "Beheerder"],
]);

const Overview = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonationError, setImpersonationError] = useState(null);
  const [impersonationTarget, setImpersonationTarget] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeUsers(({ data, error: listenerError }) => {
      if (listenerError) {
        setError(listenerError);
        setLoading(false);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
      setError(null);
      setLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const formatRole = (role) => {
    if (!role) return "Onbekend";
    const normalized = role.toString().trim().toLowerCase();
    if (!normalized) return "Onbekend";
    return ROLE_LABELS.get(normalized) || role;
  };

  const resolveRedirectPath = (role) => {
    switch (role) {
      case "coach":
        return "/coach";
      case "kwaliteitscoordinator":
        return "/kwaliteitscoordinator";
      case "assessor":
        return "/assessor";
      case "customer":
      case "user":
        return "/customer";
      default:
        return "/dashboard";
    }
  };

  const handleImpersonate = async (user) => {
    if (!user) return;
    const role = (user.role || "").toLowerCase();
  if (!role || !["customer", "coach", "user", "kwaliteitscoordinator", "assessor"].includes(role)) return;
    setImpersonationError(null);
    setImpersonationTarget(user.id);
    try {
      const response = await post("/auth/admin/impersonate", { firebaseUid: user.id });
      const customToken = response?.targetCustomToken || response?.customerCustomToken;
      if (!customToken) {
        throw new Error("Geen impersonatie-token ontvangen");
      }

      const currentUser = localStorage.getItem("user") || null;
      let parsedUser = null;
      if (currentUser) {
        try {
          parsedUser = JSON.parse(currentUser);
        } catch (_) {
          parsedUser = null;
        }
      }

      const backup = {
        user: currentUser,
        userData: parsedUser,
        targetFirebaseUid: user.id,
        targetRole: role,
        targetName: user.name || "",
        createdAt: new Date().toISOString(),
        adminCustomToken: response.adminCustomToken || null,
      };

      localStorage.setItem("impersonationBackup", JSON.stringify(backup));
      // Sign in to Firebase as the customer using the custom token
      await signInWithCustomToken(auth, customToken);
      // Store minimal user profile for UI context
      if (response.user) {
        localStorage.setItem("user", JSON.stringify(response.user));
      }
      try {
        await post("/auth/track-login", {});
      } catch (_) {
        // best effort
      }
      const redirectPath = response.redirectPath || resolveRedirectPath(role);
      navigate(redirectPath, { replace: true });
    } catch (impersonationErr) {
  const message = impersonationErr?.data?.error || impersonationErr?.message || "Kon account niet openen";
      setImpersonationError(message);
    } finally {
      setImpersonationTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Accountbeheer</h1>
        <p className="mt-2 text-sm text-slate-500">
          Beheer accounts en stap in de kandidaat- of begeleidersomgeving om hun voortgang direct te bekijken.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Kan accounts niet laden: {error.message || "Onbekende fout"}
        </div>
      ) : null}

      {impersonationError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {impersonationError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Naam
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                E-mail
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rol
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actie
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-600">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                  Accounts laden...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                  Nog geen accounts gevonden.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const normalizedRole = (user.role || "").toLowerCase();
                const isCustomer = normalizedRole === "customer" || normalizedRole === "user";
                const isCoach = normalizedRole === "coach";
                const isQuality = normalizedRole === "kwaliteitscoordinator";
                const isAssessor = normalizedRole === "assessor";
                const canImpersonate = isCustomer || isCoach || isQuality || isAssessor;
                const buttonLabel = isCoach
                  ? "Log in als begeleider"
                  : isQuality
                  ? "Open als kwaliteitscoordinator"
                  : isAssessor
                  ? "Open als assessor"
                  : isCustomer
                  ? "Open als kandidaat"
                  : "Niet beschikbaar";
                return (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{user.name || "Naam onbekend"}</td>
                    <td className="px-4 py-3">
                      {user.email ? (
                        <a href={`mailto:${user.email}`} className="text-brand-600 hover:text-brand-500">
                          {user.email}
                        </a>
                      ) : (
                        <span className="text-slate-400">Geen e-mail</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {formatRole(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleImpersonate(user)}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
                          canImpersonate && impersonationTarget !== user.id
                            ? "bg-brand-600 text-white shadow-sm hover:bg-brand-500"
                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                        }`}
                        disabled={!canImpersonate || impersonationTarget === user.id}
                      >
                        {canImpersonate
                          ? impersonationTarget === user.id
                            ? "Bezig..."
                            : buttonLabel
                          : "Niet beschikbaar"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Overview;
