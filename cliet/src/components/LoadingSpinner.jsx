import React from "react";

const LoadingSpinner = ({ label = "Bezig met laden" }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-slate-500">
      <span className="inline-flex h-12 w-12 animate-spin items-center justify-center rounded-full border-4 border-slate-200 border-t-brand-500" />
      <p>{label}…</p>
    </div>
  );
};

export default LoadingSpinner;
