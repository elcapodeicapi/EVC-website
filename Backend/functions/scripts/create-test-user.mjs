import admin from "firebase-admin";
import { randomBytes } from "node:crypto";

// Point Admin SDK at local emulators
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "evcwebsite12345";

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId });
}

function randEmail() {
  const token = randomBytes(4).toString("hex");
  return `test+${token}@example.com`;
}

(async () => {
  try {
    const email = process.env.TEST_USER_EMAIL || randEmail();
    const password = process.env.TEST_USER_PASSWORD || "TempPass123!";
    const displayName = process.env.TEST_USER_NAME || "EVC Test User";

    const user = await admin.auth().createUser({ email, password, displayName, emailVerified: true });
    console.log("Created user:", { uid: user.uid, email: user.email });
    console.log("This should trigger the sendWelcomeEmail function in the emulator.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to create test user:", err?.message || err);
    process.exit(2);
  }
})();
