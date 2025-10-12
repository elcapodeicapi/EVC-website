const { CustomerProfile, User } = require("../Models");

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
    };
  }

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
    const userId = req.user.id;
    const [user, profile] = await Promise.all([
      User.findByPk(userId, { attributes: ["id", "email", "name"] }),
      CustomerProfile.findOne({ where: { UserId: userId } }),
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const normalized = normalizeProfile(profile);
    return res.json({
      ...normalized,
      email: user.email,
      name: user.name || "",
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Failed to load profile" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, { attributes: ["id", "email", "name"] });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const payload = sanitizePayload(req.body);

    const [profile, created] = await CustomerProfile.findOrCreate({
      where: { UserId: userId },
      defaults: { UserId: userId, ...payload },
    });

    if (!created) {
      await profile.update(payload);
    }

    const normalized = normalizeProfile(profile);
    return res.json({
      ...normalized,
      email: user.email,
      name: user.name || "",
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Failed to update profile" });
  }
};
