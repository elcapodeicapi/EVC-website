/**
 * sendTrajectoryWarning.mjs
 * Scheduled function to email candidates 2 weeks before trajectory end (3 months from account creation).
 */

import sgMail from "@sendgrid/mail";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const functions = require("firebase-functions/v1");
const firebaseHelpers = require("../firebase");
const { getDb } = firebaseHelpers;

let sendgridConfigured = false;
function setupSendGrid() {
  if (sendgridConfigured) return;
  try {
    const config = functions.config?.() || {};
    const key = config?.sendgrid?.key || process.env.SENDGRID_API_KEY || "";
    if (key) {
      sgMail.setApiKey(key);
      sendgridConfigured = true;
    } else {
      functions.logger.warn("SendGrid key not configured for warning mails.");
    }
  } catch (err) {
    functions.logger.error("SendGrid setup failed", err);
  }
}

function asDate(value) {
  try {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === "function") return value.toDate();
    if (typeof value?._seconds === "number") return new Date(value._seconds * 1000);
    if (typeof value === "string") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === "number") {
      // Assume millis
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function isWithinWindow(date, start, endExclusive) {
  const t = date.getTime();
  return t >= start.getTime() && t < endExclusive.getTime();
}

function renderEmail({ name, fromEmail, toEmail }) {
  const subject = "Let op: jouw EVC-traject sluit over 2 weken";
  const greetingName = name || (toEmail ? String(toEmail).split("@")[0] : "deelnemer");
  const textLines = [
    `Beste ${greetingName},`,
    "",
    "Je EVC-traject loopt over 2 weken af.",
    "Zorg ervoor dat je al je bewijsstukken hebt toegevoegd en je portfolio volledig is.",
    "",
    "Na deze periode wordt je traject afgesloten en kun je geen wijzigingen meer aanbrengen.",
    "",
    "Met vriendelijke groet,",
    "Team EVC GO",
  ];
  const text = textLines.join("\n");
  const html = [
    `<p>Beste ${greetingName},</p>`,
    `<p>Je EVC-traject loopt over 2 weken af.<br/>Zorg ervoor dat je al je bewijsstukken hebt toegevoegd en je portfolio volledig is.</p>`,
    `<p>Na deze periode wordt je traject afgesloten en kun je geen wijzigingen meer aanbrengen.</p>`,
    `<p>Met vriendelijke groet,<br/>Team EVC GO</p>`,
  ].join("");
  return { subject, from: fromEmail, to: toEmail, text, html };
}

export const sendTrajectoryWarningEmail = functions
  .region("europe-west1")
  .pubsub.schedule("every 24 hours")
  .timeZone("Europe/Amsterdam")
  .onRun(async () => {
    setupSendGrid();
    const db = getDb();

    const config = functions.config?.() || {};
    const fromEmail = config?.evc?.from_email || process.env.MAIL_FROM || "info@mijnevcgo.nl";

    const now = new Date();
    // Window for accounts created around 76 days ago (2.5 months approx.)
    const windowEnd = addDays(now, -76); // createdAt < windowEnd
    const windowStart = addDays(now, -77); // createdAt >= windowStart

    // Helper to fetch candidates for a given role within createdAt window
    async function fetchRole(role) {
      try {
        const snap = await db
          .collection("users")
          .where("role", "==", role)
          .where("createdAt", ">=", windowStart)
          .where("createdAt", "<", windowEnd)
          .get();
        return snap.docs || [];
      } catch (err) {
        functions.logger.error("Query failed", { role, error: err?.message || err });
        return [];
      }
    }

    const [customerDocs, userDocs] = await Promise.all([fetchRole("customer"), fetchRole("user")]);
    const allDocs = [...customerDocs, ...userDocs].filter(Boolean);

    if (allDocs.length === 0) {
      functions.logger.info("No candidates in 76-day window today.");
      return null;
    }

    let sent = 0;
    for (const doc of allDocs) {
      try {
        const data = doc.data() || {};
        if (data.warningEmailSent === true) {
          continue; // already sent
        }
        const email = data.email || data.mail || null;
        if (!email) continue;
        const createdAt = asDate(data.createdAt);
        if (!createdAt) continue;
        // Double-check window guard in case createdAt type was not query-filterable
        if (!isWithinWindow(createdAt, windowStart, windowEnd)) continue;

        const msg = renderEmail({ name: data.name, fromEmail, toEmail: email });
        if (sendgridConfigured) {
          await sgMail.send({ to: msg.to, from: msg.from, subject: msg.subject, text: msg.text, html: msg.html });
        } else {
          functions.logger.warn("SendGrid not configured; skipping send", { to: email });
          continue; // don't mark as sent if nothing was sent
        }

        await doc.ref.set(
          {
            warningEmailSent: true,
            warningEmailSentAt: new Date().toISOString(),
          },
          { merge: true }
        );
        sent += 1;
      } catch (err) {
        functions.logger.error("Failed processing candidate warning", {
          userId: doc.id,
          error: err?.message || err,
        });
      }
    }

    functions.logger.info("Trajectory warning emails processed.", { candidatesChecked: allDocs.length, sent });
    return null;
  });
