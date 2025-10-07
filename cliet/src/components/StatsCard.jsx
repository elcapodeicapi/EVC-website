import React from "react";
import clsx from "clsx";

const StatsCard = ({ title, value, trend, icon: Icon, variant = "brand" }) => {
  const palette = {
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    slate: "bg-slate-50 text-slate-700",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-card transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        {Icon ? (
          <span className={clsx("rounded-full p-3", palette[variant] || palette.brand)}>
            <Icon className="h-6 w-6" />
          </span>
        ) : null}
      </div>
      {trend ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              trend.direction === "up"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            )}
          >
            {trend.direction === "up" ? "▲" : "▼"}
            {trend.value}
          </span>
          <span>{trend.caption}</span>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-transparent via-white/40 to-transparent opacity-0 transition group-hover:opacity-100" />
    </div>
  );
};

export default StatsCard;
