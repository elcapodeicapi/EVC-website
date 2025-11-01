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

// Small helper to retry async operations
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    // Generate a fresh temporary password and store it immediately in Firestore
    const temp = generateTempPassword();
    const generatedAt = new Date().toISOString();
    try {
      await db.collection("users").doc(uid).set(
        {
          temporaryPassword: temp,
          passwordGeneratedAt: generatedAt,
          temporaryPasswordSet: false,
        },
        { merge: true }
      );
    } catch (err) {
      functions.logger.warn("Failed to persist temporaryPassword metadata early", {
        uid,
        error: err?.message || err,
      });
    }

    // Try up to 5 times to set the password in Firebase Auth (800ms * attempt backoff)
    let passwordSet = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await auth.updateUser(uid, { password: temp });
        passwordSet = true;
        // Mark as applied
        try {
          await db.collection("users").doc(uid).set(
            {
              temporaryPasswordSet: true,
              temporaryPasswordAppliedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          functions.logger.warn("Failed to update temporaryPasswordSet flag", {
            uid,
            error: err?.message || err,
          });
        }
        break;
      } catch (err) {
        functions.logger.warn(`Attempt ${attempt} to set temp password failed`, {
          uid,
          error: err?.message || err,
        });
        await sleep(800 * attempt);
      }
    }
    const password = temp; // Always use the initially generated password in the email

    const name =
      userData?.name ||
      user.displayName ||
      email.split("@")[0] ||
      "deelnemer";

    const loginUrl = `${String(websiteUrl).replace(/\/$/, "")}/login`;
    const lines = [
      `Beste ${name},`,
      "",
      `Je kunt op ${websiteUrl} inloggen met de volgende gegevens:`,
      "",
      `E-mail: ${email}`,
      `Wachtwoord: ${password}`,
      "",
      "",
      'Wij adviseren je om het wachtwoord direct te wijzigen onder "Mijn profiel".',
      "",
      "Met vriendelijke groet,",
      "Team EVC GO",
    ];
    const body = lines.join("\n");

    const msg = {
      to: email,
      from: mailFrom,
      subject: "Welkom bij jouw EVC-traject",
      text: body,
      html: [
        `<p>Beste ${name},</p>`,
        `<p>Je kunt op <a href="${websiteUrl}" target="_blank" rel="noopener noreferrer">${websiteUrl}</a> inloggen met de volgende gegevens:</p>`,
        `<p><strong>E-mail:</strong> ${email}<br/><strong>Wachtwoord:</strong> ${password}</p>`,
        `<p>Wij adviseren je om het wachtwoord direct te wijzigen onder "Mijn profiel".</p>`,
        `<p>Met vriendelijke groet,<br/>Team EVC GO</p>`,
      ].join("")
    };

    try {
      await sgMail.send(msg);
      functions.logger.info("Welcome email sent successfully", { uid, email });
    } catch (err) {
      functions.logger.error("Error sending email", { uid, email, error: err?.message || err });
    }
  });
