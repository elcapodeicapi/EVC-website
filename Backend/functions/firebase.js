const admin = require("firebase-admin");
let dotenvLoaded = false;
function maybeLoadDotenv() {
  if (dotenvLoaded) return;
  // Load dotenv only if available (local emulator). In production, env vars are provided by the platform.
  let dotenv;
  try {
    // eslint-disable-next-line global-require
    dotenv = require("dotenv");
  } catch (_) {
    dotenv = null;
  }
  if (!dotenv) {
    dotenvLoaded = true;
    return;
  }
  try {
    // Load default .env if explicitly configured
    if (process.env.DOTENV_CONFIG_PATH) {
      dotenv.config({ path: process.env.DOTENV_CONFIG_PATH, override: false });
    } else {
      // Best-effort: load .env from repo root if present
      dotenv.config({ override: false });
    }
  } catch (_) {
    // ignore dotenv issues in emulator; envs are optional
  } finally {
    dotenvLoaded = true;
  }
}

function readFirebaseConfig() {
  try {
    return process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Failed to parse FIREBASE_CONFIG:", error?.message || error);
    return {};
  }
}

const truthy = new Set(["true", "1", "yes", "on"]);
const isFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === "true";
const shouldUseEmulators =
  isFunctionsEmulator ||
  truthy.has(String(process.env.USE_FIREBASE_EMULATORS || "").toLowerCase());

const firebaseConfig = readFirebaseConfig();
const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  firebaseConfig.projectId ||
  "evcwebsite12345";

const rawBucket =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.STORAGE_BUCKET ||
  process.env.VITE_FIREBASE_STORAGE_BUCKET ||
  firebaseConfig.storageBucket ||
  (projectId ? `${projectId}.appspot.com` : null);

const storageBucket = rawBucket ? rawBucket.replace(/^"|"$/g, "") : null;

if (shouldUseEmulators) {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  }
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
  }
}

let appInitialized = false;
let cachedBucket;
let bucketWarningLogged = false;
let emulatorLogPrinted = false;

function ensureAppInitialized() {
  if (appInitialized) return;
  // Lazily load dotenv so module import stays fast for the emulator manifest step
  maybeLoadDotenv();

  const options = { projectId };
  if (storageBucket) {
    options.storageBucket = storageBucket;
  }

  // In Google-managed environments (Cloud Functions/Run), prefer remote signing via a
  // specific service account ID so the Admin SDK can create custom tokens reliably.
  // This avoids bundling a private key. It requires granting the runtime service account
  // the "Service Account Token Creator" role on the signer service account.
  // See: https://firebase.google.com/docs/auth/admin/create-custom-tokens
  if (!shouldUseEmulators && projectId) {
    const inferredServiceAccountId = `${projectId}@appspot.gserviceaccount.com`;
    const configuredServiceAccountId =
      process.env.FIREBASE_SERVICE_ACCOUNT_ID ||
      process.env.SERVICE_ACCOUNT_ID ||
      inferredServiceAccountId;
    if (configuredServiceAccountId) {
      options.serviceAccountId = configuredServiceAccountId;
    }
  }

  if (!admin.apps.length) {
    admin.initializeApp(options);
    if (isFunctionsEmulator) {
      // eslint-disable-next-line no-console
      console.log("\u{1F525} Running with local emulators");
    }
  }

  appInitialized = true;
}

function logEmulatorTargets() {
  if (!shouldUseEmulators || emulatorLogPrinted) return;
  emulatorLogPrinted = true;
  // eslint-disable-next-line no-console
  console.log("Firebase Admin SDK configured to use local emulators.");
  // eslint-disable-next-line no-console
  console.log(
    "Auth:", process.env.FIREBASE_AUTH_EMULATOR_HOST,
    "Firestore:", process.env.FIRESTORE_EMULATOR_HOST,
    "Storage:", process.env.FIREBASE_STORAGE_EMULATOR_HOST
  );
}

function getDb() {
  ensureAppInitialized();
  logEmulatorTargets();
  return admin.firestore();
}

function getAuth() {
  ensureAppInitialized();
  logEmulatorTargets();
  return admin.auth();
}

function getStorage() {
  ensureAppInitialized();
  logEmulatorTargets();
  return admin.storage();
}

function getBucket() {
  if (cachedBucket !== undefined) {
    return cachedBucket;
  }

  const storage = getStorage();
  cachedBucket = storageBucket ? storage.bucket(storageBucket) : null;

  if (!cachedBucket && !bucketWarningLogged) {
    bucketWarningLogged = true;
    // eslint-disable-next-line no-console
    console.warn("Firebase Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or VITE_FIREBASE_STORAGE_BUCKET.");
  }

  return cachedBucket;
}

function createLazyService(getter) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const resource = getter();
        if (resource == null) {
          return undefined;
        }
        const value = resource[prop];
        return typeof value === "function" ? value.bind(resource) : value;
      },
      has(_target, prop) {
        const resource = getter();
        if (resource == null) {
          return false;
        }
        return prop in resource;
      },
      ownKeys() {
        const resource = getter();
        return resource ? Reflect.ownKeys(resource) : [];
      },
      getOwnPropertyDescriptor(_target, prop) {
        const resource = getter();
        if (resource == null) {
          return undefined;
        }
        const descriptor = Object.getOwnPropertyDescriptor(resource, prop);
        if (!descriptor) return undefined;
        return {
          ...descriptor,
          configurable: true,
        };
      },
      getPrototypeOf() {
        const resource = getter();
        return resource ? Object.getPrototypeOf(resource) : null;
      },
      set(_target, prop, value) {
        const resource = getter();
        if (resource == null) {
          throw new Error("Cannot set properties on an uninitialized Firebase service");
        }
        resource[prop] = value;
        return true;
      },
    }
  );
}

const dbProxy = createLazyService(getDb);
const authProxy = createLazyService(getAuth);
const storageProxy = createLazyService(getStorage);
const bucketProxy = createLazyService(getBucket);

module.exports = {
  ensureAppInitialized,
  getDb,
  getAuth,
  getStorage,
  getBucket,
  storageBucket,
  db: dbProxy,
  auth: authProxy,
  storage: storageProxy,
  bucket: bucketProxy,
};
