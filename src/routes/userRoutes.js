const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

function validateIds(ids) {
  return Array.isArray(ids) && ids.length > 0;
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, email, status, last_login_at, last_activity_at, created_at
      FROM users
      ORDER BY last_login_at DESC NULLS LAST, created_at DESC
      `
    );

    return res.json({
      currentUser: req.user,
      users: result.rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Could not load users.",
    });
  }
});

router.patch("/block", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!validateIds(ids)) {
      return res.status(400).json({
        message: "Select at least one user.",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        previous_status = CASE
          WHEN status = 'blocked' THEN previous_status
          ELSE status
        END,
        status = 'blocked'
      WHERE id = ANY($1::uuid[])
      RETURNING id, email, status, previous_status
      `,
      [ids]
    );

    return res.json({
      message: "Selected users were blocked successfully.",
      users: result.rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Block operation failed.",
    });
  }
});
router.patch("/unblock", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!validateIds(ids)) {
      return res.status(400).json({
        message: "Select at least one user.",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        status = COALESCE(previous_status, 'unverified'),
        previous_status = NULL
      WHERE id = ANY($1::uuid[])
        AND status = 'blocked'
      RETURNING id, email, status
      `,
      [ids]
    );

    return res.json({
      message:
        "Selected users were unblocked successfully and returned to their previous status.",
      users: result.rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Unblock operation failed.",
    });
  }
});
router.delete("/", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!validateIds(ids)) {
      return res.status(400).json({
        message: "Select at least one user.",
      });
    }

    // important: deleted users are physically deleted, not marked
    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = ANY($1::uuid[])
      RETURNING id, email
      `,
      [ids]
    );

    return res.json({
      message: "Selected users were deleted successfully.",
      users: result.rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Delete operation failed.",
    });
  }
});

router.delete("/unverified", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM users
      WHERE status = 'unverified'
      RETURNING id, email
      `
    );

    return res.json({
      message: "Unverified users were deleted successfully.",
      users: result.rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Delete unverified operation failed.",
    });
  }
});

module.exports = router;