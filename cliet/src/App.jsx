import React, { useEffect } from "react";
import AppPages from "./pages/App";

function VersionWatcher() {
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/", { cache: "no-store" });
        const text = await response.text();
        const match = text.match(/src="\/assets\/(.*?)\.js/);
        const latestHash = match ? match[1] : null;
        const currentHash = window.localStorage.getItem("app_build_hash");

        if (latestHash && currentHash && latestHash !== currentHash) {
          // eslint-disable-next-line no-console
          console.log("🔄 New version detected, reloading...");
          window.localStorage.removeItem("app_build_hash");
          window.location.reload();
        } else if (latestHash && !currentHash) {
          window.localStorage.setItem("app_build_hash", latestHash);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Version check failed:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return null;
}

export default function App() {
  return (
    <>
      <VersionWatcher />
      <AppPages />
    </>
  );
}
