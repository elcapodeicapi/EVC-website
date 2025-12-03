import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence, onIdTokenChanged, onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "fake-api-key", // ignored in emulator
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localhost",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "evcwebsite12345",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Use initializeFirestore with auto-detected long polling to be resilient to
// proxies/ad blockers that interfere with streaming channels.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  // Disable fetch streams for wider compatibility across browsers/extensions
  useFetchStreams: false,
});
export const storage = getStorage(app);

// Initialize Analytics only in supported environments and when configured
export let analytics;
if (typeof window !== "undefined") {
  try {
    analyticsIsSupported().then((supported) => {
      if (supported && (import.meta?.env?.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId)) {
        try {
          analytics = getAnalytics(app);
        } catch (_) {
          // No-op if analytics fails to initialize (e.g., in some browsers / emulator contexts)
        }
      }
    });
  } catch (_) {
    // ignore
  }
}

// Connect to local emulators in development. Use VITE_USE_EMULATORS=true to force.
const isLocalHost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const shouldUseEmulators =
  import.meta?.env?.DEV === true ||
  import.meta?.env?.VITE_USE_EMULATORS === "true" ||
  import.meta?.env?.USE_FIREBASE_EMULATORS === "true" ||
  isLocalHost;

let emulatorsConnected = false;
if (!emulatorsConnected && shouldUseEmulators) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099");
  } catch (_) {
    // Ignore if already connected during HMR
  }
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
  } catch (_) {
    // Ignore if already connected during HMR
  }
  try {
    connectStorageEmulator(storage, "localhost", 9199);
  } catch (_) {
    // Ignore if already connected during HMR
  }
  emulatorsConnected = true;
}

// Make sessions persistent (stay logged in until explicit logout)
try {
  setPersistence(auth, browserLocalPersistence);
} catch (_) {
  // ignore during SSR/HMR
}

// Keep ID token fresh proactively so API calls don't hit expired tokens
let lastTokenRefresh = 0;
onIdTokenChanged(auth, async (user) => {
  if (!user) return;
  const now = Date.now();
  // Throttle explicit refreshes to at most once per 5 minutes
  if (now - lastTokenRefresh > 5 * 60 * 1000) {
    try {
      await user.getIdToken(true);
      lastTokenRefresh = now;
    } catch (_) {
      // best effort
    }
  }
});

// Enforce max session age: auto-logout and redirect when token is too old.
// Configurable maximum session duration.
// Note: For testing, you can set `VITE_MAX_SESSION_MINUTES` in the environment to override the TTL in minutes.
// The hours-based env `VITE_MAX_SESSION_HOURS` is commented out here to avoid confusion during minute-based testing.
export const MAX_SESSION_HOURS = Number(import.meta?.env?.VITE_MAX_SESSION_HOURS ?? 12);

// Fallback: if minutes not provided, default to 12 hours.


onAuthStateChanged(auth, async (user) => {
  // If not logged in, do nothing; normal route guards/UI will handle access.
  if (!user) return;
  try {
    const tokenResult = await getIdTokenResult(user);
    // authTime is an RFC3339/ISO timestamp string; convert to Date.
    const lastAuth = new Date(tokenResult.authTime);
    const now = new Date();

    const hoursDiff = (now - lastAuth) / 36e5;
    // If token age exceeds the max, end session and redirect to Home.
    if (hoursDiff > MAX_SESSION_HOURS) {
      try { await auth.signOut(); } catch (_) { /* best-effort sign-out */ }
      // Hard redirect prevents stale app state or cached views.
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  } catch (_) {
    // If we cannot read the token, fail safe by leaving state as-is.
    // Firebase will refresh tokens automatically when the app is active.
  }
});
