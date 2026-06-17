const nodemailer = require("nodemailer");

async function sendVerificationEmail(email, token) {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.MAIL_FROM
  ) {
    console.log("SMTP is not configured. Verification link:");
    console.log(`${process.env.CLIENT_URL}/verify?token=${token}`);
    return;
  }

  const smtpPort = Number(process.env.SMTP_PORT || 587);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const verifyUrl = `${process.env.CLIENT_URL}/verify?token=${token}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Verify your account",
    html: `
      <p>Hello,</p>
      <p>Please verify your account by clicking the link below:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>If your account is blocked, verification will not unblock it.</p>
    `,
  });
}

module.exports = {
  sendVerificationEmail,
};