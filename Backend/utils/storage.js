const path = require("path");
const { bucket } = require("../firebase");

function sanitizeFilename(name) {
  if (!name) return `file-${Date.now()}`;
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function saveBuffer(destination, buffer, { contentType, metadata } = {}) {
  const file = bucket.file(destination);
  await file.save(buffer, {
    resumable: false,
    contentType: contentType || undefined,
    metadata: metadata || undefined,
  });
  return file;
}

function buildEmulatorDownloadUrl(file) {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (!host) return null;
  return `http://${host}/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
}

async function getDownloadUrl(file) {
  const emulatorUrl = buildEmulatorDownloadUrl(file);
  if (emulatorUrl) {
    return emulatorUrl;
  }
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: "03-01-2080",
  });
  return signedUrl;
}

async function uploadBuffer(destination, buffer, options = {}) {
  const file = await saveBuffer(destination, buffer, options);
  const downloadUrl = await getDownloadUrl(file);
  return { file, downloadUrl };
}

module.exports = {
  bucket,
  sanitizeFilename,
  saveBuffer,
  getDownloadUrl,
  uploadBuffer,
};
