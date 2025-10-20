import React, { useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

const ModalForm = ({ open, title, description, onClose, children, footer }) => {
  useEffect(() => {
    if (open) {
      const onKey = (event) => {
        if (event.key === "Escape") {
          onClose?.();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Sluiten</span>
        </button>
        <div className="px-6 pb-6 pt-8 sm:px-8">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
            {description ? (
              <p className="mt-2 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <div className="space-y-4">{children}</div>
        </div>
        <div className={clsx("flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 sm:px-8", footer ? "" : "hidden")}>{footer}</div>
      </div>
    </div>
  );
};

export default ModalForm;
