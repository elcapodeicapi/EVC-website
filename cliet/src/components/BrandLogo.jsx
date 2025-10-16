import React from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import LogoImage from "../data/EVC_logo.png";

const toneMap = {
  light: {
    shell: "bg-evc-blue-600 text-white ring-evc-blue-500/60 shadow-sm",
    hover: "hover:bg-evc-blue-500",
    image: "h-6 w-auto",
  },
  dark: {
    shell: "bg-white/10 text-white ring-white/20 shadow-lg",
    hover: "hover:bg-white/20",
    image: "h-6 w-auto drop-shadow-[0_2px_6px_rgba(15,23,42,0.45)]",
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
          "inline-flex items-center justify-center rounded-2xl px-3 py-2 ring-1 ring-inset",
          palette.shell,
          palette.hover
        )}
      >
        <img src={LogoImage} alt="EVC GO" className={palette.image} />
      </span>
      <span className="sr-only">EVC GO</span>
    </Link>
  );
};

export default BrandLogo;
