const crypto = require("crypto");

function getVerificationToken() {
  // note: token for email verification link
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  getVerificationToken,
};