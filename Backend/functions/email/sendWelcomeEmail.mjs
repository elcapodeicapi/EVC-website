/**
 * sendWelcomeEmail.mjs
 * 1st-Gen Firebase Function – runs alongside Gen 2 functions.
 */


import sgMail from "@sendgrid/mail";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";


const require = createRequire(import.meta.url);
const functions = require("firebase-functions/v1");
const firebaseHelpers = require("../firebase");
const { getDb, getAuth } = firebaseHelpers;

// -- Lazy SendGrid setup
let sendgridConfigured = false;
function setupSendGrid() {
  if (sendgridConfigured) return;
  try {
    const config = functions.config?.() || {};
    const key =
      config?.sendgrid?.key ||
      process.env.SENDGRID_API_KEY ||
      "";
    if (key) {
      sgMail.setApiKey(key);
      sendgridConfigured = true;
    } else {
      functions.logger.warn("SendGrid key not configured.");
    }
  } catch (err) {
    functions.logger.error("SendGrid setup failed", err);
  }
}

// -- Helpers ---------------------------------------------------------------
function generateTempPassword(length = 12) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}


function shouldSend(user, data) {
  if (!user.email) return false;
  if (!data) return true;
  const createdByAdmin =
    data.createdBy === "admin" ||
    data.isAdminCreated === true ||
    Boolean(data.createdByAdminId);
  return createdByAdmin || ["customer", "user"].includes(String(data.role).toLowerCase());
}

// -- Main Trigger ----------------------------------------------------------
export const sendWelcomeEmail = functions
  .region("europe-west1")
  .auth.user()
  .onCreate(async (user) => {
    setupSendGrid();
    const db = getDb();
    const auth = getAuth();

    const config = functions.config?.() || {};
    const mailFrom = config?.evc?.from_email || process.env.MAIL_FROM || "info@mijnevcgo.nl";
    const websiteUrl = config?.evc?.site_url || process.env.WEBSITE_URL || "https://mijnevcgo.nl";

    const { uid, email } = user;
    if (!email) {
      functions.logger.warn("User has no email; skipping welcome email.", { uid });
      return;
    }

    // Fetch user Firestore data
    let userData = null;
    try {
      const snap = await db.collection("users").doc(uid).get();
      if (snap.exists) userData = snap.data();
    } catch (err) {
      functions.logger.error("Failed to fetch Firestore user data", err);
    }

    if (!shouldSend(user, userData)) {
      functions.logger.info("Skipping email based on metadata", { uid, email });
      return;
    }

    // Always generate a fresh temporary password and set it for the user
    let password;
    try {
      const temp = generateTempPassword();
      await auth.updateUser(uid, { password: temp });
      await db.collection("users").doc(uid).set(
        {
          temporaryPassword: temp,
          passwordGeneratedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      password = temp;
    } catch (err) {
      functions.logger.error("Could not set temporary password for new user", err);
      // As a last resort, keep instructions to use password reset
      password = "(stel je wachtwoord in via 'Wachtwoord vergeten')";
    }

    const name =
      userData?.name ||
      user.displayName ||
      email.split("@")[0] ||
      "deelnemer";

    const body = [
      `Beste ${name},`,
      "",
      `Je kunt op ${websiteUrl} inloggen met de volgende gegevens:`,
      "",
      `E-mail: ${email}`,
      `Wachtwoord: ${password}`,
      "",
      'Wij adviseren je om het wachtwoord direct te wijzigen onder "Mijn profiel".',
      "",
      "Met vriendelijke groet,",
      "Team EVC GO",
    ].join("\n");

    const msg = {
      to: email,
      from: mailFrom,
      subject: "Welkom bij jouw EVC-traject",
      text: body,
    };

    try {
      await sgMail.send(msg);
      functions.logger.info("Welcome email sent successfully", { uid, email });
    } catch (err) {
      functions.logger.error("Error sending email", { uid, email, error: err?.message || err });
    }
  });
