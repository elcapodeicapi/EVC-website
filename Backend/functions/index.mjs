import { onRequest } from "firebase-functions/v2/https";
import { onInit } from "firebase-functions/v2/core";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let createAppFactory; // lazy require to avoid heavy work during manifest generation
let appInstance;

onInit(() => {
  // Keep import-time work minimal to avoid manifest timeouts.
});

export const app = onRequest({ region: "europe-west1", maxInstances: 10, memory: "512MiB" }, (req, res) => {
  if (req.url === "/api") {
    req.url = "/";
  } else if (req.url.startsWith("/api/")) {
    req.url = req.url.replace(/^\/api/, "") || "/";
  }

  if (!appInstance) {
    if (!createAppFactory) {
      createAppFactory = require("./app");
    }
    appInstance = createAppFactory();
  }
  return appInstance(req, res);
});

export const ping = onRequest({ region: "europe-west1" }, (_req, res) => {
  res.status(200).send("ok");
});

// Re-export triggers from modular files to keep the entrypoint lean
export { sendWelcomeEmail } from "./email/sendWelcomeEmail.mjs";
