/**
 * sendWelcomeEmail.mjs
 * 1st-Gen Firebase Function – runs alongside Gen 2 functions.
 */


import sgMail from "@sendgrid/mail";
import { Resend } from "resend";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";


const require = createRequire(import.meta.url);
const functions = require("firebase-functions/v1");
const firebaseHelpers = require("../firebase");
const { getDb, getAuth } = firebaseHelpers;

function safeFunctionsConfig() {
  try {
    if (typeof functions.config !== "function") return {};
    return functions.config() || {};
  } catch (_) {
    return {};
  }
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set (required when USE_RESEND=true)");
  }

  const resend = new Resend(apiKey);
  return resend;
}

// -- Lazy SendGrid setup
let sendgridConfigured = false;
function setupSendGrid(required = false) {
  if (sendgridConfigured) return;
  try {
    const config = safeFunctionsConfig();
    const key =
      config?.sendgrid?.key ||
      process.env.SENDGRID_API_KEY ||
      "";
    if (key) {
      sgMail.setApiKey(key);
      sendgridConfigured = true;
    } else {
      if (required) {
        throw new Error("SendGrid key not configured (missing SENDGRID_API_KEY)");
      }
      functions.logger.warn("SendGrid key not configured.");
    }
  } catch (err) {
    functions.logger.error("SendGrid setup failed", err);
    if (required) throw err;
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

function isUseResendEnabled() {
  return String(process.env.USE_RESEND || "").toLowerCase() === "true";
}

async function sendWelcomeEmailWithResend({ from, to, subject, html }) {
  const resend = getResendClient();
  const toList = Array.isArray(to) ? to : [to];
  return resend.emails.send({
    from,
    to: toList,
    subject,
    html,
  });
}

async function sendWelcomeEmailWithSendGrid(msg) {
  return sgMail.send(msg);
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

function buildWelcomeMessage({ email, name, password, mailFrom, websiteUrl }) {
  const safeWebsiteUrl = String(websiteUrl || "").trim() || "https://mijnevcgo.nl";
  const displayName = (name || "").trim() || email.split("@")[0] || "deelnemer";

  const lines = [
    `Beste ${displayName},`,
    "",
    `Je kunt op ${safeWebsiteUrl} inloggen met de volgende gegevens:`,
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

  const text = lines.join("\n");
  const html = [
    `<p>Beste ${displayName},</p>`,
    `<p>Je kunt op <a href="${safeWebsiteUrl}" target="_blank" rel="noopener noreferrer">${safeWebsiteUrl}</a> inloggen met de volgende gegevens:</p>`,
    `<p><strong>E-mail:</strong> ${email}<br/><strong>Wachtwoord:</strong> ${password}</p>`,
    `<p>Wij adviseren je om het wachtwoord direct te wijzigen onder "Mijn profiel".</p>`,
    `<p>Met vriendelijke groet,<br/>Team EVC GO</p>`,
  ].join("");

  return {
    to: email,
    from: mailFrom,
    subject: "Welkom bij jouw EVC-traject",
    text,
    html,
  };
}

// Helper for Gen2 adminCreateUser: sends welcome email using the admin-provided password.
// Not a deployed Firebase Function (only used via import from server code).
export async function sendWelcomeEmailDirect({ uid, email, name, password }) {
  if (!email) throw new Error("sendWelcomeEmailDirect: email is required");
  if (!password) throw new Error("sendWelcomeEmailDirect: password is required");

  const config = safeFunctionsConfig();
  const mailFrom =
    config?.evc?.from_email ||
    process.env.MAIL_FROM ||
    process.env.FROM_EMAIL ||
    "info@mijnevcgo.nl";
  const websiteUrl = config?.evc?.site_url || process.env.WEBSITE_URL || "https://mijnevcgo.nl";

  const msg = buildWelcomeMessage({ email, name, password, mailFrom, websiteUrl });

  try {
    if (isUseResendEnabled()) {
      await sendWelcomeEmailWithResend({
        from: msg.from,
        to: [email],
        subject: msg.subject,
        html: msg.html,
      });
      functions.logger.info("Welcome email sent successfully (Resend)", { uid, email });
      return { provider: "resend" };
    }

    setupSendGrid(true);
    await sendWelcomeEmailWithSendGrid(msg);
    functions.logger.info("Welcome email sent successfully (SendGrid)", { uid, email });
    return { provider: "sendgrid" };
  } catch (err) {
    const provider = isUseResendEnabled() ? "resend" : "sendgrid";
    functions.logger.error("Error sending direct welcome email", {
      uid,
      email,
      provider,
      error: err?.message || err,
    });

    if (provider === "resend") {
      throw new Error(`Resend welcome email failed: ${err?.message || String(err)}`);
    }
    throw new Error(`SendGrid welcome email failed: ${err?.message || String(err)}`);
  }
}

// -- Main Trigger ----------------------------------------------------------
export const sendWelcomeEmail = functions
  .region("europe-west1")
  .auth.user()
  .onCreate(async (user) => {
    // IMPORTANT:
    // Admin-created users must keep the admin-provided password.
    // This trigger previously generated/overwrote passwords, which breaks admin flows.
    // Welcome emails with the correct password are now sent from the adminCreateUser endpoint.
    void user;
    return null;
  });
