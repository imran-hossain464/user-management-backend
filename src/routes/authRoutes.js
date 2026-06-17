const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { getVerificationToken } = require("../utils/tokens");
const { sendVerificationEmail } = require("../utils/mailer");

const router = express.Router();

function createToken(userId) {
  // nota bene: token contains only user id; user status is checked fresh on every protected request
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = getVerificationToken();

    // important: no manual duplicate email check here; database unique index handles it
    const result = await pool.query(
      `
      INSERT INTO users (name, email, password_hash, status, verification_token)
      VALUES ($1, $2, $3, 'unverified', $4)
      RETURNING id, name, email, status, created_at
      `,
      [name.trim(), email.trim().toLowerCase(), passwordHash, verificationToken]
    );

    // note: email is sent asynchronously after registration succeeds
    sendVerificationEmail(email.trim().toLowerCase(), verificationToken).catch(
      (error) => {
        console.error("Verification email failed:", error.message);
      }
    );

    return res.status(201).json({
      message:
        "Registration successful. You can login now. Verification email will be sent shortly.",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "This email is already registered.",
      });
    }

    console.error(error);

    return res.status(500).json({
      message: "Registration failed.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const result = await pool.query(
      `
      SELECT id, name, email, password_hash, status, created_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [email.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    if (user.status === "blocked") {
      return res.status(403).json({
        message: "Your account is blocked.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    await pool.query(
      `
      UPDATE users
      SET last_login_at = NOW(), last_activity_at = NOW()
      WHERE id = $1
      `,
      [user.id]
    );

    const token = createToken(user.id);

    return res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Login failed.",
    });
  }
});

router.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        message: "Verification token is required.",
      });
    }

    // important: blocked users stay blocked
    const result = await pool.query(
      `
      UPDATE users
      SET
        status = CASE
          WHEN status = 'blocked' THEN 'blocked'
          ELSE 'active'
        END,
        verification_token = NULL
      WHERE verification_token = $1
      RETURNING id, email, status
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid or expired verification link.",
      });
    }

    return res.json({
      message: "Email verification completed.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Verification failed.",
    });
  }
});

module.exports = router;