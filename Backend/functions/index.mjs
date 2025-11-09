import { onRequest } from "firebase-functions/v2/https";
import { onInit } from "firebase-functions/v2/core";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

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
// Scheduled: warn candidates 2 weeks before 3-month end
export { sendTrajectoryWarningEmail } from "./email/sendTrajectoryWarning.mjs";
// Scheduled: archive expired trajectories
export { archiveExpiredTrajects } from "./scheduler/archiveExpiredTrajects.mjs";
// Auth blocking: prevent archived candidates from signing in
// Note: beforeUserSignedIn (blocking functions) require Identity Platform (GCIP) to be enabled
// for the project. Deploying this export on a non-GCIP project causes a 400 OPERATION_NOT_ALLOWED.
// To enable once GCIP is turned on, uncomment the line below.
export { blockArchivedCandidateSignIn } from "./auth/blockArchivedSignIn.mjs";

// --- Firestore -> Auth custom claims sync ---
// Keep roles in Firebase Auth custom claims in sync with Firestore users/{uid}.role
export const syncUserRoleClaims = onDocumentWritten(
  { document: "users/{uid}", region: "europe-west1" },
  async (event) => {
    const uid = event?.params?.uid;
    const after = event?.data?.after?.data();
    if (!uid) {
      console.log("[claims] Missing uid param; skipping.");
      return;
    }
    if (!after) {
      // Deleted or missing doc; do not change claims (explicitly).
      console.log(`[claims] users/${uid} deleted or missing; no claim update.`);
      return;
    }

    const rawRole = (after.role ?? after.Role ?? after.userRole ?? "").toString().trim().toLowerCase();
    // Map legacy aliases
    const role = rawRole === "user" ? "customer" : rawRole;
    if (!role) {
      console.log(`[claims] users/${uid} has empty role; skipping claims update.`);
      return;
    }
    const allowed = new Set(["admin", "coach", "assessor", "kwaliteitscoordinator", "customer"]);
    const claimRole = allowed.has(role) ? role : "customer";

    try {
      const adminSdk = await import("./firebase.js");
      const auth = adminSdk.getAuth();
      await auth.setCustomUserClaims(uid, { role: claimRole });
      console.log(`[claims] Set custom claims for ${uid} => { role: "${claimRole}" }`);
    } catch (error) {
      console.error(`[claims] Failed to set claims for ${uid}:`, error?.message || error);
    }
  }
);
