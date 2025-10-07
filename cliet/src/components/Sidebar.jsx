import React from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";

const Sidebar = ({ header, navItems = [], footer, onNavigate }) => {
  return (
    <aside className="flex h-full flex-col bg-white shadow-lg">
      <div className="px-6 pb-4 pt-6 border-b border-slate-100">
        {header || (
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">EVC Portal</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Coaching Suite</h1>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
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
                      "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )
                  }
                >
                  {Icon ? (
                    <Icon className="mr-3 h-4 w-4 flex-none text-slate-400 group-hover:text-brand-600" />
                  ) : null}
                  <span className="truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      {footer ? <div className="border-t border-slate-100 p-4">{footer}</div> : null}
    </aside>
  );
};

export default Sidebar;
