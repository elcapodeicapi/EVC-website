#!/usr/bin/env node
/**
 * One-time script to backfill custom claims for existing admins.
 *
 * Usage (with Application Default Credentials):
 *   - Ensure you have ADC configured: `gcloud auth application-default login`
 *   - Or set GOOGLE_APPLICATION_CREDENTIALS to a Service Account JSON with permissions.
 *   - Then run: `node Backend/functions/scripts/backfillAdminClaims.mjs`
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

async function main() {
  initializeApp({
    credential: applicationDefault(),
  });

  const db = getFirestore();
  const auth = getAuth();

  const adminsQuery = db.collection("users").where("role", "==", "admin");
  const snapshot = await adminsQuery.get();

  console.log(`[backfill] Found ${snapshot.size} admin user(s).`);

  let success = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const uid = doc.id;
    try {
      await auth.setCustomUserClaims(uid, { role: "admin" });
      console.log(`[backfill] Set { role: "admin" } for uid=${uid}`);
      success += 1;
    } catch (err) {
      console.error(`[backfill] Failed to set claims for uid=${uid}:`, err?.message || err);
      failed += 1;
    }
  }

  console.log(`[backfill] Done. success=${success}, failed=${failed}`);
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err?.message || err);
  process.exitCode = 1;
});
