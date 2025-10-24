import React, { useMemo, useState } from "react";
import ModalForm from "./ModalForm";
import { auth } from "../firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

const mapAuthError = (code, message) => {
  if (!code) return message || "Er is iets misgegaan.";
  const msg = {
    "auth/wrong-password": "Het huidige wachtwoord is onjuist.",
    "auth/weak-password": "Het nieuwe wachtwoord is te zwak (minimaal 6 tekens, bij voorkeur 8+).",
    "auth/requires-recent-login":
      "Om je wachtwoord te wijzigen moet je recent opnieuw inloggen. Log uit en log opnieuw in.",
    "auth/too-many-requests":
      "Te veel pogingen. Probeer het later opnieuw of reset je wachtwoord.",
    "auth/user-mismatch": "Account komt niet overeen. Probeer opnieuw in te loggen.",
    "auth/user-not-found": "Gebruiker niet gevonden. Probeer opnieuw in te loggen.",
  }[code];
  return msg || message || "Wijzigen van wachtwoord is mislukt.";
};

const ChangePasswordModal = ({ open, onClose }) => {
  const user = auth.currentUser;
  const email = useMemo(() => user?.email || "", [user?.email]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const resetState = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    setSubmitting(false);
    setError(null);
    setSuccess(null);
  };

  const handleClose = () => {
    resetState();
    onClose?.();
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!user) {
      setError("Je bent niet ingelogd. Log opnieuw in en probeer het opnieuw.");
      return;
    }
    const usesPasswordProvider = Array.isArray(user.providerData)
      ? user.providerData.some((p) => p?.providerId === "password")
      : false;
    if (!usesPasswordProvider) {
      setError(
        "Je account gebruikt een externe inlogmethode. Wachtwoord wijzigen is hier niet beschikbaar. Gebruik 'Wachtwoord vergeten' of neem contact op met je beheerder."
      );
      return;
    }
    if (!currentPassword) {
      setError("Vul je huidige wachtwoord in.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("Kies een nieuw wachtwoord van minimaal 6 tekens (liefst 8+).");
      return;
    }
    if (newPassword !== confirm) {
      setError("De bevestiging komt niet overeen met het nieuwe wachtwoord.");
      return;
    }
    setSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setSuccess("Je wachtwoord is bijgewerkt.");
    } catch (err) {
      const friendly = mapAuthError(err?.code, err?.message);
      setError(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalForm
      open={open}
      onClose={handleClose}
      title="Wachtwoord wijzigen"
      description="Vul je huidige wachtwoord in en kies een nieuw wachtwoord."
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={submitting}
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
            disabled={submitting}
          >
            {submitting ? "Opslaan..." : "Wachtwoord opslaan"}
          </button>
        </>
      }
    >
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>
      ) : null}
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Huidig wachtwoord</label>
        <div className="flex items-center gap-2">
          <input
            type={showCur ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Vul je huidige wachtwoord in"
          />
          <button
            type="button"
            onClick={() => setShowCur((v) => !v)}
            className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {showCur ? "Verberg" : "Toon"}
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Nieuw wachtwoord</label>
        <div className="flex items-center gap-2">
          <input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Minimaal 6 tekens"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {showNew ? "Verberg" : "Toon"}
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Bevestig nieuw wachtwoord</label>
        <div className="flex items-center gap-2">
          <input
            type={showConf ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Herhaal het nieuwe wachtwoord"
          />
          <button
            type="button"
            onClick={() => setShowConf((v) => !v)}
            className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {showConf ? "Verberg" : "Toon"}
          </button>
        </div>
      </div>
    </ModalForm>
  );
};

export default ChangePasswordModal;
