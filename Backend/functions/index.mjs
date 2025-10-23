import { onRequest } from "firebase-functions/v2/https";
import { onInit } from "firebase-functions/v2/core";

let appInstance;
let createAppFactory;

// Use dynamic import for app to keep entrypoint light
async function loadApp() {
  if (!createAppFactory) {
    const appModule = await import("./app.js");
    createAppFactory = appModule.default || appModule;
  }
  if (!appInstance) appInstance = createAppFactory();
  return appInstance;
}

onInit(async () => {
  // Keep init lightweight
});

export const app = onRequest({ region: "europe-west1", maxInstances: 10, memory: "512MiB" }, async (req, res) => {
  if (req.url === "/api") req.url = "/";
  else if (req.url.startsWith("/api/")) req.url = req.url.replace(/^\/api/, "") || "/";

  const app = await loadApp();
  return app(req, res);
});

export const ping = onRequest({ region: "europe-west1" }, (_req, res) => {
  res.status(200).send("ok");
});

// Export the auth trigger directly so Firebase can discover it for the emulator/deploy manifest
export { sendWelcomeEmail } from "./email/sendWelcomeEmail.mjs";
