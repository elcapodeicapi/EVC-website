import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "fake-api-key", // ignored in emulator
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localhost",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "evcwebsite12345",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Connect to local emulators in development. Use VITE_USE_EMULATORS=true to force.
const isLocalHost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const shouldUseEmulators =
  import.meta?.env?.DEV === true ||
  import.meta?.env?.VITE_USE_EMULATORS === "true" ||
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
