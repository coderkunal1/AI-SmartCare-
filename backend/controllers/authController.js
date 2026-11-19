const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { createNotification } = require("../utils/notificationHelper");
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_token_key";

const register = async (req, res) => {
  try {
    const { name, email, password, role = "doctor", specialty, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: "This email already exists. Please login instead." });
    }

    const user = new User({ name, email: normalizedEmail, password, role, specialty, phone });
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });

    res.status(201).json({
      message: "Registration successful.",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, specialty: user.specialty }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Registration failed." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });

    await createNotification({
      userId: user._id,
      title: "Doctor logged in successfully",
      detail: `Welcome back, Dr. ${user.name}. Your care dashboard is ready.`,
      type: "success",
      category: "login"
    });

    res.json({
      message: "Login successful.",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, specialty: user.specialty }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Login failed." });
  }
};

const profile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not fetch profile." });
  }
};

module.exports = {
  register,
  login,
  profile
};
