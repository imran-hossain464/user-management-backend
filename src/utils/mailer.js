const { Resend } = require("resend");

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.CLIENT_URL}/verify?token=${token}`;

  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) {
    console.log("Email API is not configured. Verification link:");
    console.log(verifyUrl);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Verify your account",
    html: `
      <p>Hello,</p>
      <p>Your account has been registered successfully.</p>
      <p>Please click the link below to verify your email:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>If your account is blocked, verification will not unblock it.</p>
    `,
  });
}

module.exports = {
  sendVerificationEmail,
};