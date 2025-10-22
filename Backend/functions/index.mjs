import { onRequest } from "firebase-functions/v2/https";
import { onInit } from "firebase-functions/v2/core";
import * as functions from "firebase-functions";
import sgMail from "@sendgrid/mail";
import { createRequire } from "node:module";
// Removed v2 identity import to use stable v1 auth trigger


const require = createRequire(import.meta.url);
const functionsV1 = require("firebase-functions/v1");
let firebaseHelpers; // lazy-loaded
let createAppFactory; // lazy require to avoid heavy work during manifest generation

function getDbLazy() {
  if (!firebaseHelpers) firebaseHelpers = require("./firebase");
  return firebaseHelpers.getDb();
}

function getAuthLazy() {
  if (!firebaseHelpers) firebaseHelpers = require("./firebase");
  return firebaseHelpers.getAuth();
}

// Defer Admin SDK init to firebaseHelpers (ensureAppInitialized is called inside getDb/getAuth)

// Lazily read runtime config and set SendGrid key once
let sendgridConfigured = false;
function getRuntimeConfig() {
  const cfg = (functions.config && typeof functions.config === "function") ? functions.config() : {};
  const sendgridKey = cfg?.sendgrid?.key || "";
  const mailFrom = cfg?.evc?.from_email || "info@mijnevcgo.nl";
  const websiteUrl = cfg?.evc?.site_url || "https://mijnevcgo.nl";
  if (sendgridKey && !sendgridConfigured) {
    try {
      sgMail.setApiKey(sendgridKey);
      sendgridConfigured = true;
    } catch (e) {
      functions.logger.error("Failed to set SendGrid API key", e?.message || e);
    }
  }
  return { sendgridKey, mailFrom, websiteUrl };
}

let appInstance;

onInit(() => {
  // Defer any initialization to runtime, not at import time, to avoid deployment timeouts
  // Warm up runtime config (and set SendGrid key once if present)
  try {
    getRuntimeConfig();
  } catch (_) {
    // ignore; config may not be available in all contexts
  }
  // Optionally, warm-load the Express app after startup (not during deployment manifest phase)
  // Leaving it lazy keeps cold starts smaller; uncomment to pre-warm:
  // try { if (!createAppFactory) { createAppFactory = require("./app"); } } catch {}
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

function resolvePasswordPlaceholder(userData) {
  if (!userData) return "[password]";
  return (
    userData.initialPassword ||
    userData.temporaryPassword ||
    userData.tempPassword ||
    "[password]"
  );
}

function shouldSendEmail(user, userData) {
  if (!user.email) return false;

  if (!userData) {
    return true; // default to sending when metadata is missing
  }

  const createdByAdmin =
    userData.createdBy === "admin" ||
    userData.isAdminCreated === true ||
    Boolean(userData.createdByAdminId);

  if (createdByAdmin) return true;

  const role = String(userData.role || "").toLowerCase();
  return role === "customer" || role === "user";
}

export const sendWelcomeEmail = functionsV1.region("europe-west1").auth.user().onCreate(async (user) => {
  const { sendgridKey, mailFrom, websiteUrl } = getRuntimeConfig();
  const email = user?.email;
  const uid = user?.uid;

  if (!email) {
    functions.logger.warn("Skipping welcome email; user has no email address.", { uid });
    return;
  }

  if (!sendgridKey) {
    functions.logger.error("SendGrid API key is missing; welcome email cannot be sent.", { uid, email });
    return;
  }

  let userData = null;
  try {
    const db = getDbLazy();
    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists) {
      userData = snap.data() || null;
    }
  } catch (error) {
    functions.logger.error("Failed to fetch user Firestore document for welcome email.", {
      uid,
      email,
      error: error?.message || error,
    });
  }

  if (!shouldSendEmail(user, userData)) {
    functions.logger.info("Welcome email skipped based on user metadata.", { uid, email });
    return;
  }

  const name = (
    (userData?.name || user?.displayName || email.split("@")[0] || "deelnemer")
  ).trim();
  let passwordForEmail = resolvePasswordPlaceholder(userData);

  // If no password was found in Firestore metadata, generate a temporary one,
  // update the Auth user, and store it back to Firestore for traceability.
  if (!passwordForEmail || passwordForEmail === "[password]") {
    try {
      // Generate a strong temporary password
      const temp = Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map((b) => (b % 36).toString(36))
        .join("");

      // Fallback if crypto.getRandomValues is unavailable in this runtime
      const tmpPwd = temp && /[a-z0-9]{12}/.test(temp) ? temp : Math.random().toString(36).slice(2, 14);

      const auth = getAuthLazy();
      await auth.updateUser(uid, { password: tmpPwd });

      const db = getDbLazy();
      await db.collection("users").doc(uid).set({ temporaryPassword: tmpPwd, passwordGeneratedAt: new Date().toISOString() }, { merge: true });

      passwordForEmail = tmpPwd;
    } catch (err) {
      functions.logger.error("Failed to generate and set a temporary password.", {
        uid,
        email,
        error: err?.message || err,
      });
      // As a last resort, include a reset instruction instead of a placeholder
      passwordForEmail = "(stel je wachtwoord in via 'Wachtwoord vergeten')";
    }
  }

  const textLines = [
    `Beste ${name},`,
    "",
    `Je kunt op ${websiteUrl} inloggen met de volgende gegevens:`,
    "",
    `Email: ${email}`,
    `Wachtwoord: ${passwordForEmail}`,
    "",
    'Wij adviseren je het wachtwoord direct te wijzigen in een zelfgekozen wachtwoord. Dit kun je doen onder de knop "Mijn profiel".',
    "",
    "Met vriendelijke groet,",
    "",
    "Team EVC GO",
  ];

  const msg = {
    to: email,
    from: mailFrom,
    subject: "Welkom bij jouw EVC-traject",
    text: textLines.join("\n"),
  };

  try {
    await sgMail.send(msg);
    functions.logger.info("Welcome email sent.", { uid, email });
  } catch (error) {
    functions.logger.error("Error sending welcome email via SendGrid.", {
      uid,
      email,
      error: error?.message || error,
    });
  }
});
