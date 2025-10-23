// Directly invoke the auth.onCreate handler with a fake user in sandbox mode
import { sendWelcomeEmail } from "../email/sendWelcomeEmail.mjs";

// Provide runtime config to firebase-functions via env var
process.env.FUNCTIONS_EMULATOR = "true";


// Minimal FIREBASE_CONFIG for admin helpers
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: "evcwebsite12345" });

const fakeUser = {
  uid: `local_${Date.now()}`,
  email: process.env.TO_EMAIL || "hudayfa2005@gmail.com",
  displayName: "Local Test User",
};

(async () => {
  try {
    // Some versions expose a 'run' method; otherwise, calling as a function works in tests
    if (typeof sendWelcomeEmail.run === 'function') {
      await sendWelcomeEmail.run(fakeUser);
    } else {
      await sendWelcomeEmail(fakeUser);
    }
    console.log("Invoked sendWelcomeEmail with sandbox enabled.");
    process.exit(0);
  } catch (err) {
    console.error("Invocation failed:", err?.message || err);
    process.exit(2);
  }
})();
