import React from "react";
import { Menu } from "lucide-react";
import BrandLogo from "./BrandLogo";

const Topbar = ({
  title,
  user,
  children,
  onToggleSidebar,
  rightSlot,
}) => {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-white/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation</span>
        </button>
        <BrandLogo className="inline-flex shrink-0" />
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">{user?.role ?? "Portal"}</p>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        {children}
      </div>
      <div className="flex items-center gap-4">
        {rightSlot}
        {user ? (
          <div className="flex items-center gap-3 rounded-full bg-slate-100/60 px-3 py-2 text-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
              {user.initials ||
                user.name?.split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() ||
                "EV"}
            </div>
            <div className="hidden sm:block">
              <p className="font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.subtitle}</p>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Topbar;
