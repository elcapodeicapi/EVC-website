import React from "react";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import EVCLogo from "../data/EVC_logo.png";

const Topbar = ({
  title,
  user,
  children,
  onToggleSidebar,
  rightSlot,
  tone = "light",
  className = "",
  logoSlot,
  logoTo = "/",
}) => {
  const tonePalettes = {
    light: {
      header: "bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70",
      role: "text-slate-400",
      title: "text-slate-900",
      toggle:
        "border-slate-200 text-slate-500 transition hover:bg-slate-100",
      userChip: "bg-slate-100/60 text-slate-900",
      initials: "bg-brand-100 text-brand-700",
      avatarWrapper: "border border-slate-200 bg-white",
      subtitle: "text-slate-500",
      rightSection: "text-slate-900",
    },
    brand: {
      header: "bg-evc-blue-600/95 text-white backdrop-blur supports-[backdrop-filter]:bg-evc-blue-600/75",
      role: "text-white/70",
      title: "text-white",
      toggle:
        "border-white/40 text-white transition hover:bg-white/10",
      userChip: "bg-white/12 text-white",
      initials: "bg-white/15 text-white",
      avatarWrapper: "border border-white/40 bg-white/10",
      subtitle: "text-white/70",
      rightSection: "text-white",
    },
  };

  const palette = tonePalettes[tone] || tonePalettes.light;
  const resolvedLogo =
    logoSlot ?? (
      <Link to={logoTo} className="inline-flex shrink-0 items-center" aria-label="Ga naar het hoofdscherm">
        <img src={EVCLogo} alt="EVC GO" className="h-7 w-auto" />
      </Link>
    );

  return (
    <header
      className={clsx(
        "sticky top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8",
        palette.header,
        className
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={clsx(
            "flex h-10 w-10 items-center justify-center rounded-full border lg:hidden",
            palette.toggle
          )}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Navigatie openen of sluiten</span>
        </button>
        {resolvedLogo}
        <div>
          <p className={clsx("text-xs uppercase tracking-widest", palette.role)}>
            {user?.role ?? "Portaal"}
          </p>
          <h2 className={clsx("text-lg font-semibold", palette.title)}>{title}</h2>
        </div>
        {children}
      </div>
      <div className={clsx("flex items-center gap-4", palette.rightSection)}>
        {rightSlot}
        {user ? (
          <div className={clsx("flex items-center gap-3 rounded-full px-3 py-2 text-sm", palette.userChip)}>
            <div
              className={clsx(
                "flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-xs font-semibold shadow-sm",
                palette.avatarWrapper,
                !(user?.photoURL) && palette.initials
              )}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.name || user.email || "Profielfoto"}
                  className="h-full w-full object-cover"
                />
              ) : (
                (user.initials ||
                  user.name?.split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() ||
                  user.email?.slice(0, 2)?.toUpperCase() ||
                  "EV")
              )}
            </div>
            <div className="hidden sm:block">
              <p className={clsx("font-medium", palette.title)}>{user.name}</p>
              <p className={clsx("text-xs", palette.subtitle)}>{user.subtitle}</p>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Topbar;
