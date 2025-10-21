const { getDb } = require("../firebase");
const { uploadBuffer, sanitizeFilename, bucket } = require("../utils/storage");
const crypto = require("crypto");

function generateId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

function coerceArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function sanitizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEducations(value) {
  return coerceArray(value)
    .map((entry) => ({
      id: sanitizeString(entry?.id) || generateId(),
      title: sanitizeString(entry?.title),
      institution: sanitizeString(entry?.institution),
      note: sanitizeString(entry?.note || entry?.description || entry?.toelichting),
      startDate: sanitizeString(entry?.startDate),
      endDate: sanitizeString(entry?.endDate),
    }))
    .filter((entry) => entry.title);
}

function normalizeCertificates(value) {
  return coerceArray(value)
    .map((entry) => ({
      id: sanitizeString(entry?.id) || generateId(),
      title: sanitizeString(entry?.title),
      filePath: sanitizeString(entry?.filePath),
      fileName: sanitizeString(entry?.fileName) || sanitizeString(entry?.originalName),
      size: typeof entry?.size === "number" ? entry.size : null,
      uploadedAt: entry?.uploadedAt ? String(entry.uploadedAt) : null,
      note: sanitizeString(entry?.note || entry?.description || entry?.toelichting),
    }))
    .filter((entry) => entry.title && entry.filePath);
}

function normalizeWorkExperience(value) {
  return coerceArray(value)
    .map((entry) => ({
      id: sanitizeString(entry?.id) || generateId(),
      role: sanitizeString(entry?.role || entry?.title),
      organisation: sanitizeString(entry?.organisation || entry?.organization || entry?.company),
      note: sanitizeString(entry?.note || entry?.description || entry?.toelichting),
      startDate: sanitizeString(entry?.startDate),
      endDate: sanitizeString(entry?.endDate),
    }))
    .filter((entry) => entry.role || entry.organisation || entry.note);
}

function normalizeProfile(profile) {
  if (!profile) {
    return {
      dateOfBirth: "",
      placeOfBirth: "",
      nationality: "",
      phoneFixed: "",
      phoneMobile: "",
      street: "",
      houseNumber: "",
      addition: "",
      postalCode: "",
      city: "",
      educations: [],
      certificates: [],
      workExperience: [],
      photoURL: "",
    };
  }

  const educations = normalizeEducations(profile.educations);
  const certificates = normalizeCertificates(profile.certificates);
  const workExperience = normalizeWorkExperience(profile.workExperience);

  return {
    dateOfBirth: profile.dateOfBirth ? String(profile.dateOfBirth) : "",
    placeOfBirth: profile.placeOfBirth || "",
    nationality: profile.nationality || "",
    phoneFixed: profile.phoneFixed || "",
    phoneMobile: profile.phoneMobile || "",
    street: profile.street || "",
    houseNumber: profile.houseNumber || "",
    addition: profile.addition || "",
    postalCode: profile.postalCode || "",
    city: profile.city || "",
    educations,
    certificates,
    workExperience,
    photoURL: profile.photoURL || "",
  };
}

function sanitizePayload(body) {
  const {
    dateOfBirth = "",
    placeOfBirth = "",
    nationality = "",
    phoneFixed = "",
    phoneMobile = "",
    street = "",
    houseNumber = "",
    addition = "",
    postalCode = "",
    city = "",
    educations = [],
    certificates = [],
    workExperience = [],
  } = body || {};

  const payload = {
    placeOfBirth: placeOfBirth.trim(),
    nationality: nationality.trim(),
    phoneFixed: phoneFixed.trim(),
    phoneMobile: phoneMobile.trim(),
    street: street.trim(),
    houseNumber: houseNumber.trim(),
    addition: addition.trim(),
    postalCode: postalCode.trim(),
    city: city.trim(),
    educations: normalizeEducations(educations),
    certificates: normalizeCertificates(certificates),
    workExperience: normalizeWorkExperience(workExperience),
  };

  const dobValue = typeof dateOfBirth === "string" ? dateOfBirth.trim() : "";
  if (dobValue && !/^\d{4}-\d{2}-\d{2}$/.test(dobValue)) {
    const error = new Error("Invalid date format (expected YYYY-MM-DD)");
    error.status = 400;
    throw error;
  }
  payload.dateOfBirth = dobValue || null;

  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") {
      payload[key] = null;
    }
  });

  return payload;
}

exports.getProfile = async (req, res) => {
  try {
    const uid = req.user.firebaseUid || req.user.uid;
    if (!uid) return res.status(400).json({ error: "Missing Firebase user id" });

    const [userSnap, profileSnap] = await Promise.all([
  getDb().collection("users").doc(uid).get(),
  getDb().collection("profiles").doc(uid).get(),
    ]);

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userSnap.data() || {};
    const normalized = normalizeProfile(profileSnap.exists ? profileSnap.data() : null);
    const resolvedPhoto = normalized.photoURL || user.photoURL || "";
    normalized.photoURL = resolvedPhoto;
    return res.json({
      ...normalized,
      email: user.email || "",
      name: user.name || "",
      photoURL: resolvedPhoto,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Failed to load profile" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const uid = req.user.firebaseUid || req.user.uid;
    if (!uid) return res.status(400).json({ error: "Missing Firebase user id" });

    const payload = sanitizePayload(req.body);

  await getDb().collection("profiles").doc(uid).set(payload, { merge: true });

    const [userSnap, profileSnap] = await Promise.all([
  getDb().collection("users").doc(uid).get(),
  getDb().collection("profiles").doc(uid).get(),
    ]);
    const user = userSnap.exists ? userSnap.data() : {};
    const normalized = normalizeProfile(profileSnap.exists ? profileSnap.data() : payload);
    const resolvedPhoto = normalized.photoURL || user.photoURL || "";
    normalized.photoURL = resolvedPhoto;
    return res.json({
      ...normalized,
      email: user.email || "",
      name: user.name || "",
      photoURL: resolvedPhoto,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Failed to update profile" });
  }
};

exports.uploadCertificate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }
    const uid = req.user.firebaseUid || req.user.uid;
    if (!uid) return res.status(400).json({ error: "Missing Firebase user id" });

    const originalName = req.file.originalname || req.file.filename || "certificate.pdf";
    const destination = `certificates/${uid}/${Date.now()}-${sanitizeFilename(originalName)}`;

    const { file, downloadUrl } = await uploadBuffer(destination, req.file.buffer, {
      contentType: req.file.mimetype,
      metadata: {
        firebaseUid: uid,
        originalName,
        type: "certificate",
      },
    });

    const metadata = {
      filePath: downloadUrl,
      downloadUrl,
      storagePath: file.name,
      bucket: bucket.name,
      fileName: originalName,
      contentType: req.file.mimetype || null,
      size: typeof req.file.size === "number" ? req.file.size : null,
      uploadedAt: new Date().toISOString(),
    };

  const snap = await getDb().collection("profiles").doc(uid).get();
    const profile = snap.exists ? snap.data() : {};
    const certificates = Array.isArray(profile.certificates) ? [...profile.certificates] : [];
    certificates.push({ id: generateId(), title: originalName, ...metadata });
  await getDb().collection("profiles").doc(uid).set({ certificates }, { merge: true });

    return res.json(metadata);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to upload certificate" });
  }
};

exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const uid = req.user.firebaseUid || req.user.uid;
    if (!uid) return res.status(400).json({ error: "Missing Firebase user id" });

    const { mimetype = "", size = null } = req.file;
    if (!mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Alleen afbeeldingsbestanden zijn toegestaan" });
    }

    const originalName = req.file.originalname || req.file.filename || "profielfoto.png";
    const destination = `profilePhotos/${uid}/${Date.now()}-${sanitizeFilename(originalName)}`;

    const { file, downloadUrl } = await uploadBuffer(destination, req.file.buffer, {
      contentType: mimetype,
      metadata: {
        firebaseUid: uid,
        originalName,
        type: "profile-photo",
      },
    });

  const profileRef = getDb().collection("profiles").doc(uid);
  const userRef = getDb().collection("users").doc(uid);

    const [profileSnap, userSnap] = await Promise.all([
      profileRef.get().catch(() => null),
      userRef.get().catch(() => null),
    ]);

    const profileData = profileSnap?.exists ? profileSnap.data() : {};
    const userData = userSnap?.exists ? userSnap.data() : {};
    const previousStoragePath = profileData?.photoStoragePath || userData?.photoStoragePath || null;

    const photoPayload = {
      photoURL: downloadUrl,
      photoStoragePath: file.name,
      photoUpdatedAt: new Date().toISOString(),
    };

    await Promise.all([
      profileRef.set(photoPayload, { merge: true }),
      userRef.set(photoPayload, { merge: true }),
    ]);

    if (previousStoragePath && previousStoragePath !== file.name) {
      try {
        await bucket.file(previousStoragePath).delete();
      } catch (deleteError) {
        if (deleteError?.code !== 404) {
          // eslint-disable-next-line no-console
          console.warn(`Failed to remove previous profile photo ${previousStoragePath}:`, deleteError.message || deleteError);
        }
      }
    }

    return res.json({
      photoURL: downloadUrl,
      storagePath: file.name,
      size: typeof size === "number" ? size : null,
      contentType: mimetype,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to upload profile photo" });
  }
};
