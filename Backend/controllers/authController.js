const { User } = require("../Models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "supersecret"; // 🔒 move to .env later

// POST /auth/register
exports.register = async (req, res) => {
  try {
    const { email, password, role, name } = req.body;
    const user = await User.create({ email, password, role, name });

    // issue JWT immediately
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ 
      message: "User registered",
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.name }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /auth/me - get current logged in user
exports.me = async (req, res) => {
  try {
    const { User } = require("../Models");
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "email", "role", "name", "createdAt"]
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};