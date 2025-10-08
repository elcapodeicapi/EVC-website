import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "fake-api-key", // will be ignored in emulator
  authDomain: "localhost",
  projectId: "evcwebsite12345",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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
  emulatorsConnected = true;
}
