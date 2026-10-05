const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const requireDatabase = require("../middleware/requireDatabase");

const router = express.Router();
const passwordRounds = 12;
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please try again later." }
});

const assertJwtSecret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "replace_with_a_long_random_secret") {
    const error = new Error("Configure a unique JWT_SECRET before using authentication.");
    error.status = 500;
    throw error;
  }
};

const createToken = userId => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const publicUser = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role
});

router.post("/register", authRateLimit, requireDatabase, asyncHandler(async (req, res) => {
  assertJwtSecret();
  const { name, email, password } = req.body || {};
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedName || !normalizedEmail || typeof password !== "string") {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }

  if (normalizedName.length > 100 || normalizedEmail.length > 254) {
    return res.status(400).json({ message: "Name or email is too long." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }

  const hashedPassword = await bcrypt.hash(password, passwordRounds);
  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    password: hashedPassword
  });

  return res.status(201).json({
    message: "Account created successfully.",
    token: createToken(user._id.toString()),
    user: publicUser(user)
  });
}));

router.post("/login", authRateLimit, requireDatabase, asyncHandler(async (req, res) => {
  assertJwtSecret();
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail || typeof password !== "string") {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = await User.findOne({ email: normalizedEmail }).select("+password");
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }

  return res.json({
    message: "Signed in successfully.",
    token: createToken(user._id.toString()),
    user: publicUser(user)
  });
}));

router.get("/me", requireDatabase, protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
