import React from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";

const tonePalettes = {
  light: {
    container: "bg-white text-slate-900 shadow-lg text-base",
    headerBorder: "border-slate-100",
    navActive: "bg-brand-50 text-brand-700",
    navInactive: "text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-base",
    iconIdle: "text-slate-500",
    iconActive: "text-brand-600",
    badge: "bg-brand-100 text-brand-700",
    footerBorder: "border-slate-100",
  },
  dark: {
    container: "bg-slate-950 text-white shadow-xl text-base",
    headerBorder: "border-white/10",
    navActive: "bg-white/10 text-white text-base",
    navInactive: "text-white/80 hover:bg-white/5 hover:text-white text-base",
    iconIdle: "text-white/50",
    iconActive: "text-white",
    badge: "bg-white/10 text-white",
    footerBorder: "border-white/10",
  },
};

const Sidebar = ({ header, navItems = [], footer, onNavigate, tone = "light" }) => {
  const palette = tonePalettes[tone] || tonePalettes.light;

  return (
    <aside className={clsx("flex h-full w-96 max-w-full flex-col lg:h-screen", palette.container)}>
      <div className={clsx("border-b px-6 pb-4 pt-6", palette.headerBorder)}>
        {header || (
          <div className="text-current">
            <p className="text-xs uppercase tracking-widest opacity-70">EVC-portaal</p>
            <h1 className="mt-1 text-xl font-semibold">Begeleidingssuite</h1>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-6 py-6">
        <ul className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => onNavigate?.(item)}
                  className={({ isActive }) =>
                    clsx(
                      "group flex items-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors",
                      isActive ? palette.navActive : palette.navInactive
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {Icon ? (
                        <Icon
                          className={clsx(
                            "mr-3 h-4 w-4 flex-none transition-colors",
                            isActive ? palette.iconActive : palette.iconIdle
                          )}
                        />
                      ) : null}
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span
                          className={clsx(
                            "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                            palette.badge
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      {footer ? <div className={clsx("border-t p-4", palette.footerBorder)}>{footer}</div> : null}
    </aside>
  );
};

export default Sidebar;
