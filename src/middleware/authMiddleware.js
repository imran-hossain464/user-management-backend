const jwt = require("jsonwebtoken");
const pool = require("../config/db");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // important: before every protected request, server checks user exists and is not blocked
    const result = await pool.query(
      `
      UPDATE users
      SET last_activity_at = NOW()
      WHERE id = $1
      RETURNING id, name, email, status, last_login_at, last_activity_at, created_at
      `,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "User account no longer exists.",
      });
    }

    const user = result.rows[0];

    if (user.status === "blocked") {
      return res.status(403).json({
        message: "Your account is blocked.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired session.",
    });
  }
}

module.exports = authMiddleware;