const jwt = require("jsonwebtoken");
const pool = require("../config/db");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please login before accessing this page.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
        message:
          "Your account no longer exists. You have been redirected to login.",
      });
    }

    const user = result.rows[0];

    if (user.status === "blocked") {
      return res.status(403).json({
        message:
          "Your account has been blocked. You have been redirected to login.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);

    return res.status(401).json({
      message: "Your session has expired. Please login again.",
    });
  }
}

module.exports = authMiddleware;