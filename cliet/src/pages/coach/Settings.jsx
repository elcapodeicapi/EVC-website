import React from "react";

const CoachSettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Profile settings</h2>
        <p className="text-sm text-slate-500">Keep your coaching profile up to date.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Personal information</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">Display name</span>
              <input
                defaultValue="Isabelle Janssen"
                className="rounded-2xl border border-slate-200 px-4 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">Email</span>
              <input
                defaultValue="isabelle.janssen@example.com"
                className="rounded-2xl border border-slate-200 px-4 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
        </section>
        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Security</h3>
          <p className="mt-2 text-sm text-slate-500">Change your password or enable two-factor authentication.</p>
          <button className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Update password
          </button>
        </section>
      </div>
      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h3 className="text-base font-semibold text-slate-900">Availability</h3>
        <p className="mt-2 text-sm text-slate-500">Share when you typically review uploads or host coaching sessions.</p>
        <textarea
          rows={4}
          placeholder="e.g. Feedback review on Tuesdays & Thursdays, 14:00 - 16:00"
          className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <button className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-500">
          Save preferences
        </button>
      </section>
    </div>
  );
};

export default CoachSettings;
