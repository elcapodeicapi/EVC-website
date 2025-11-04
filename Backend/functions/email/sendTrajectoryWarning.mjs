/**
 * sendTrajectoryWarning.mjs
 * Scheduled function to email candidates 2 weeks before EVC-traject einddatum.
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

function toYMD(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function amsterdamMidnight(date = new Date()) {
  // Compute the 00:00:00 time of the given date in Europe/Amsterdam, represented as a JS Date
  const fmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const d = parseInt(get("day"), 10);
  // Construct a Date in Amsterdam local midnight by creating a Date from components, then adjusting using the same TZ offset
  // Simpler: create using Date.UTC and let comparisons be in UTC since we convert to Firestore Timestamps
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
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

    const todayAms = amsterdamMidnight(new Date());
    const targetDayStart = addDays(todayAms, 14); // 14 days from today
    const targetDayEnd = addDays(targetDayStart, 1);

    const admin = require("firebase-admin");
    const tsStart = admin.firestore.Timestamp.fromDate(targetDayStart);
    const tsEnd = admin.firestore.Timestamp.fromDate(targetDayEnd);

    async function fetchRole(role) {
      try {
        const snap = await db
          .collection("users")
          .where("role", "==", role)
          .where("evcEndDate", ">=", tsStart)
          .where("evcEndDate", "<", tsEnd)
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
        const endDate = asDate(data.evcEndDate);
        if (!endDate) continue;
        // Check not already sent for this endDate (allows reschedule if end date changes)
        const lastFor = data.warningEmailForEndDate || null;
        const endYmd = toYMD(endDate);
        if (lastFor && String(lastFor) === endYmd) {
          continue;
        }
        const email = data.email || data.mail || null;
        if (!email) continue;
        // Double-check the endDate falls within the target 1-day window
        if (!isWithinWindow(endDate, targetDayStart, targetDayEnd)) continue;

        const msg = renderEmail({ name: data.name, fromEmail, toEmail: email });
        if (sendgridConfigured) {
          await sgMail.send({ to: msg.to, from: msg.from, subject: msg.subject, text: msg.text, html: msg.html });
        } else {
          functions.logger.warn("SendGrid not configured; skipping send", { to: email });
          continue; // don't mark as sent if nothing was sent
        }

        await doc.ref.set(
          {
            warningEmailForEndDate: endYmd,
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

    functions.logger.info("Trajectory warning emails processed.", { candidatesChecked: allDocs.length, sent, targetDay: targetDayStart.toISOString().slice(0,10) });
    return null;
  });
