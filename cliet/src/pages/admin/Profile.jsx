import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import { subscribeAdminProfile } from "../../lib/firestoreAdmin";

const ROLE_LABELS = new Map([
  ["admin", "Beheerder"],
  ["coach", "Begeleider"],
  ["customer", "Kandidaat"],
  ["user", "Kandidaat"],
]);

const resolveRoleLabel = (role) => {
  if (!role) return "Beheerder";
  const normalized = role.toString().trim().toLowerCase();
  if (!normalized) return "Beheerder";
  return ROLE_LABELS.get(normalized) || role;
};

const AdminProfile = () => {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const resolvedUid = parsed?.firebaseUid || parsed?.uid;
        if (resolvedUid && mounted) {
          setUid(resolvedUid);
        }
      } catch (e) {
        // ignore malformed storage
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (current) => {
      if (mounted) {
        setUid((prev) => prev || current?.uid || null);
      }
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = subscribeAdminProfile(uid, ({ data, error: snapshotError }) => {
      if (snapshotError) {
        setError(snapshotError);
        setLoading(false);
        return;
      }
      setProfile(data);
      setError(null);
      setLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [uid]);

  const highlights = Array.isArray(profile?.highlights) ? profile.highlights : [];
  const responsibilities = Array.isArray(profile?.responsibilities) ? profile.responsibilities : [];
  const certifications = Array.isArray(profile?.certifications) ? profile.certifications : [];

  const displayRole = resolveRoleLabel(profile?.role);

  const displayName = profile?.name || profile?.email || "Beheerder";

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm">
        Profiel laden...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-700 shadow-sm">
        Kon profiel niet laden: {error.message || "Onbekende fout"}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm">
        Geen profielgegevens gevonden. Zorg dat je account is gekoppeld aan Firebase.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-8 py-10 text-white shadow-card">
        <p className="text-sm uppercase tracking-[0.35em] text-white/60">Profiel</p>
        <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-3xl font-semibold">{displayName}</h2>
            <p className="mt-2 text-white/80">{displayRole}</p>
            <p className="mt-3 max-w-2xl text-sm text-white/70">{profile.bio || "Nog geen biografie toegevoegd."}</p>
          </div>
          <dl className="grid grid-cols-3 gap-4">
            {highlights.length === 0 ? (
              <div className="col-span-3 text-sm text-white/70">Nog geen statistieken vastgelegd.</div>
            ) : null}
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className="rounded-2xl bg-white/10 px-4 py-3 text-center shadow-inner backdrop-blur"
              >
                <dt className="text-xs uppercase tracking-[0.3em] text-white/70">{highlight.label}</dt>
                <dd className="mt-2 text-2xl font-semibold">{highlight.metric}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <article className="rounded-3xl bg-white p-6 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Contact &amp; verantwoordelijkheden</h3>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">E-mail</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{profile.email || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Telefoon</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{profile.phone || "Niet opgegeven"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Locatie</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{profile.location || "Niet opgegeven"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Kernverantwoordelijkheden</p>
              {responsibilities.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Nog geen verantwoordelijkheden toegevoegd.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {responsibilities.map((item) => (
                    <li key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </article>

      </section>

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h3 className="text-base font-semibold text-slate-900">Certificeringen &amp; professionalisering</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {certifications.length === 0 ? (
            <p className="col-span-full text-sm text-slate-500">Nog geen certificeringen geregistreerd.</p>
          ) : null}
          {certifications.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-100 p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900">{item.title || "Certificering"}</p>
              <p className="text-xs text-slate-500">{item.issuer || "Onbekende instantie"}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                Behaald in {item.year || "-"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminProfile;
