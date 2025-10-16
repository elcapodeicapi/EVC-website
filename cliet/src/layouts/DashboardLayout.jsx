import React, { useState } from "react";
import clsx from "clsx";

const DashboardLayout = ({ sidebar, topbar, children, className = "", mainClassName = "", contentClassName = "" }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={clsx("min-h-screen bg-transparent text-slate-900", className)}>
      <div className="lg:grid lg:grid-cols-[320px,1fr]">
        <div
          className={clsx(
            "fixed inset-y-0 left-0 z-40 w-80 max-w-full transform bg-white shadow-xl transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:translate-x-0 lg:shadow-none lg:transform-none",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {sidebar
            ? React.cloneElement(sidebar, {
                onNavigate: (...args) => {
                  sidebar.props.onNavigate?.(...args);
                  setIsSidebarOpen(false);
                },
              })
            : null}
        </div>

        <div className="flex min-h-screen flex-col lg:col-start-2">
          {topbar
            ? React.cloneElement(topbar, {
                onToggleSidebar: () => setIsSidebarOpen((prev) => !prev),
              })
            : null}
          <main className={clsx("flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-10", mainClassName)}>
            <div className={clsx("mx-auto w-full max-w-7xl space-y-8", contentClassName)}>{children}</div>
          </main>
        </div>
      </div>

      {isSidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default DashboardLayout;
