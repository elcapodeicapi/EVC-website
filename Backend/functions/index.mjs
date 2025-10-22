import { onRequest } from "firebase-functions/v2/https";
import { onInit } from "firebase-functions/v2/core";
import * as functions from "firebase-functions";
import sgMail from "@sendgrid/mail";
import * as admin from "firebase-admin";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const createApp = require("./app");
const firebaseHelpers = require("./firebase");

const { ensureAppInitialized, getDb } = firebaseHelpers;

// Ensure the Admin SDK is initialized with the project's preferred configuration.
ensureAppInitialized();
if (!admin.apps.length) {
  admin.initializeApp();
}

const sendgridConfig = functions.config().sendgrid || {};
const sendgridKey = sendgridConfig.key || "";
if (sendgridKey) {
  sgMail.setApiKey(sendgridKey);
} else {
  functions.logger.warn(
    "SendGrid API key is not configured. Set it with `firebase functions:config:set sendgrid.key=\"YOUR_SENDGRID_KEY\"`."
  );
}

const mailFrom = (functions.config().evc && functions.config().evc.from_email) || "info@mijnevcgo.nl";
const websiteUrl = (functions.config().evc && functions.config().evc.site_url) || "https://mijnevcgo.nl";

let appInstance;

onInit(() => {
  // Intentionally left blank to keep cold-start work minimal.
});

export const app = onRequest({ region: "europe-west1", maxInstances: 10, memory: "512MiB" }, (req, res) => {
  if (req.url === "/api") {
    req.url = "/";
  } else if (req.url.startsWith("/api/")) {
    req.url = req.url.replace(/^\/api/, "") || "/";
  }

  if (!appInstance) appInstance = createApp();
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

export const sendWelcomeEmail = functions.auth.user().onCreate(async (user) => {
  const email = user.email;
  const uid = user.uid;

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
    const db = getDb();
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
    (userData?.name || user.displayName || email.split("@")[0] || "deelnemer")
  ).trim();
  const passwordForEmail = resolvePasswordPlaceholder(userData);

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
