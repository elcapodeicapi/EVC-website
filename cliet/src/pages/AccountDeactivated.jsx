import React from "react";
import LegacyPageLayout from "./LegacyPageLayout";

export default function AccountDeactivated() {
  return (
    <LegacyPageLayout showHeader={false} showNavbar={false}>
      <section className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-2xl sm:p-10">
          <h1 className="text-2xl font-semibold text-slate-900">Je account is gedeactiveerd.</h1>
          <p className="mt-4 text-slate-600">
            Neem contact op met EVC GO om je traject te verlengen of opnieuw te activeren.
          </p>
        </div>
      </section>
    </LegacyPageLayout>
  );
}
