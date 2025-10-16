const admin = require("firebase-admin");

const useEmulators =
  (process.env.USE_FIREBASE_EMULATORS ?? "true").toLowerCase() !== "false" &&
  process.env.NODE_ENV !== "production";

const projectId = process.env.FIREBASE_PROJECT_ID || "evcwebsite12345";
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

if (useEmulators) {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  }
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
  }
}

// Initialize Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp({
    projectId,
    storageBucket,
  });
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const bucket = storage.bucket();

// Log when pointing to emulators (Admin SDK respects these env vars automatically)
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  // eslint-disable-next-line no-console
  console.log("Using Firebase Auth Emulator:", process.env.FIREBASE_AUTH_EMULATOR_HOST);
}
if (process.env.FIRESTORE_EMULATOR_HOST) {
  // eslint-disable-next-line no-console
  console.log("Using Firestore Emulator:", process.env.FIRESTORE_EMULATOR_HOST);
}
if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  // eslint-disable-next-line no-console
  console.log("Using Firebase Storage Emulator:", process.env.FIREBASE_STORAGE_EMULATOR_HOST);
}

module.exports = { db, auth, storage, bucket };
