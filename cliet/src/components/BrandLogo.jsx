import React from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

const BrandMark = ({ className = "" }) => (
  <svg
    className={clsx("h-6 w-auto", className)}
    viewBox="0 0 120 32"
    aria-hidden="true"
    focusable="false"
  >
    <g fill="currentColor">
      <path d="M0 2h19.5v4H4.8v6h12.6v4H4.8v6h15v4H0z" />
      <path d="M25.4 2h6.2l8 20.1L47.7 2h6.2L40 30h-4z" />
      <path d="M59 0.7c10.6 0 18.7 7.4 18.7 15.3 0 8-8.1 15.3-18.7 15.3-9 0-17.5-6.2-18.5-14.5h7.4c1 4.2 5.8 8 11 8 6.4 0 11.6-4.5 11.6-8.8 0-4.4-5.2-8.9-11.6-8.9-5.2 0-10 3.7-11 8H40.5c1-8.2 9.5-14.4 18.5-14.4z" />
      <path d="M85.4 7.4c3.5-3.5 8.5-5.6 13.9-5.6 9.5 0 17.2 6.4 17.2 15.3 0 8.7-7.5 15.3-17.2 15.3-7.4 0-12.8-3.5-15.7-9.2l6.6-3c1.7 3.3 4.7 5.2 9.2 5.2 6.1 0 10.3-4.3 10.3-8.3 0-4.3-3.9-8.4-10.3-8.4-3.4 0-6.5 1.3-8.6 3.5l-3.7-2.7.3-.3z" />
      <circle cx="114" cy="5" r="4" />
    </g>
  </svg>
);

const toneMap = {
  light: {
    wrapper: "bg-evc-blue-600 text-white",
    hover: "hover:bg-evc-blue-500",
    border: "border-evc-blue-400/30",
  },
  dark: {
    wrapper: "bg-white text-evc-blue-600",
    hover: "hover:bg-white/90",
    border: "border-white/40",
  },
};

const BrandLogo = ({ to = "/", className = "", tone = "light" }) => {
  const palette = toneMap[tone] ?? toneMap.light;
  return (
    <Link
      to={to}
      className={clsx("inline-flex items-center gap-2 transition", className)}
      aria-label="Ga naar de EVC GO homepage"
    >
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded-2xl border px-3 py-2 shadow-sm",
          palette.wrapper,
          palette.hover,
          palette.border
        )}
      >
        <BrandMark />
      </span>
      <span className="sr-only">EVC GO</span>
    </Link>
  );
};

export default BrandLogo;
