import sgMail from "@sendgrid/mail";
import * as functions from "firebase-functions";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

// Use stable v1 auth trigger via CommonJS require to avoid ESM interop issues
const require = createRequire(import.meta.url);
const functionsV1 = require("firebase-functions/v1");

let firebaseHelpers; // lazy-loaded to keep import time light
let sendgridConfigured = false;

function getDbLazy() {
  if (!firebaseHelpers) firebaseHelpers = require("../firebase");
  return firebaseHelpers.getDb();
}

function getAuthLazy() {
  if (!firebaseHelpers) firebaseHelpers = require("../firebase");
  return firebaseHelpers.getAuth();
}

function getRuntimeConfig() {
  const cfg = (functions.config && typeof functions.config === "function") ? functions.config() : {};
  const sendgridKey = cfg?.sendgrid?.key || "";
  const mailFrom = cfg?.evc?.from_email || "info@mijnevcgo.nl";
  const websiteUrl = cfg?.evc?.site_url || "https://mijnevcgo.nl";
  const sandboxDefault = process.env.FUNCTIONS_EMULATOR === "true";
  const sandboxCfg = cfg?.sendgrid?.sandbox;
  const sandbox = sandboxCfg == null ? sandboxDefault : String(sandboxCfg).toLowerCase() !== "false";
  if (sendgridKey && !sendgridConfigured) {
    try {
      sgMail.setApiKey(sendgridKey);
      sendgridConfigured = true;
    } catch (e) {
      functions.logger.error("Failed to set SendGrid API key", e?.message || e);
    }
  }
  return { sendgridKey, mailFrom, websiteUrl, sandbox };
}

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

function generateTempPassword(length = 12) {
  // Alphanumeric with at least one uppercase to satisfy common policies
  const bytes = randomBytes(length);
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  // Ensure it has at least one uppercase, one lowercase, and one digit
  if (!/[A-Z]/.test(pwd)) pwd = 'A' + pwd.slice(1);
  if (!/[a-z]/.test(pwd)) pwd = pwd.slice(0, -1) + 'a';
  if (!/[0-9]/.test(pwd)) pwd = pwd.slice(0, -2) + '0' + pwd.slice(-1);
  return pwd;
}

export const sendWelcomeEmail = functionsV1
  .region("europe-west1")
  .auth.user()
  .onCreate(async (user) => {
    const { sendgridKey, mailFrom, websiteUrl, sandbox } = getRuntimeConfig();
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
        const tmpPwd = generateTempPassword(12);

        const auth = getAuthLazy();
        await auth.updateUser(uid, { password: tmpPwd });

        const db = getDbLazy();
        await db.collection("users").doc(uid).set(
          { temporaryPassword: tmpPwd, passwordGeneratedAt: new Date().toISOString() },
          { merge: true }
        );

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
      ...(sandbox ? { mailSettings: { sandboxMode: { enable: true } } } : {}),
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