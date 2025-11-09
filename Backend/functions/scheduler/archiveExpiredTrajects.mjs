import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const functions = require("firebase-functions/v1");
const adminSdk = await import("../firebase.js");
const { getDb } = adminSdk;

function amsterdamMidnight(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const d = parseInt(get("day"), 10);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

export const archiveExpiredTrajects = functions
  .region("europe-west1")
  .pubsub.schedule("0 0 * * *")
  .timeZone("Europe/Amsterdam")
  .onRun(async () => {
    const db = getDb();

    const todayStart = amsterdamMidnight(new Date());
    const admin = require("firebase-admin");
    const tsCutoff = admin.firestore.Timestamp.fromDate(todayStart);

    // We search for users (customers) whose evcEndDate < todayStart
    const roles = ["customer", "user"]; // legacy 'user' means candidate
    const queries = roles.map((role) =>
      db.collection("users").where("role", "==", role).where("evcEndDate", "<", tsCutoff).get()
    );

    const snapshots = await Promise.allSettled(queries);
    const docs = snapshots
      .flatMap((res) => (res.status === "fulfilled" ? res.value.docs || [] : []))
      .filter(Boolean);

    if (docs.length === 0) {
      functions.logger.info("No expired trajectories to archive today.");
      return null;
    }

    let updated = 0;

    for (const doc of docs) {
      try {
        const uid = doc.id;
        const assignRef = db.collection("assignments").doc(uid);
        const snap = await assignRef.get();
        if (!snap.exists) continue;
        const data = snap.data() || {};
        const status = (data.status || "").toString();
        if (status === "In archief") continue;
        await assignRef.set(
          {
            status: "In archief",
            archivedAt: new Date().toISOString(),
            statusUpdatedAt: new Date(),
            statusUpdatedByRole: "system",
          },
          { merge: true }
        );
        updated += 1;
      } catch (err) {
        functions.logger.error("Failed to archive trajectory", { userId: doc?.id, error: err?.message || err });
      }
    }

    functions.logger.info("Archived expired trajectories", { candidatesChecked: docs.length, archivedCount: updated });
    return null;
  });
