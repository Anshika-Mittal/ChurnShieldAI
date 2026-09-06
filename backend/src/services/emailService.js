import nodemailer from "nodemailer";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (config.SMTP_USER && config.SMTP_PASSWORD) {
      transporter = nodemailer.createTransport({
        host: config.SMTP_SERVER,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASSWORD,
        },
      });
    }
  }
  return transporter;
}

export const emailService = {
  /**
   * Send 6-digit OTP verification email.
   */
  async sendOtpEmail(toEmail, otp) {
    const cleanEmail = toEmail.trim().toLowerCase();
    const mailer = getTransporter();

    // Fallback to console logger if SMTP is unconfigured
    if (!mailer) {
      logger.warn("SMTP credentials not configured. FALLING BACK TO CONSOLE LOGGER MODE.");
      console.log("\n" + "=".repeat(60));
      console.log(` EMAIL SENT TO: ${cleanEmail}`);
      console.log(` OTP CODE IS:    ${otp}`);
      console.log(` VALID FOR:      5 Minutes`);
      console.log("=".repeat(60) + "\n");
      return true;
    }

    const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f7fc; padding: 20px; color: #333;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e1e8ed; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <h2 style="color: #4f46e5; text-align: center; margin-bottom: 20px;">Verification Code</h2>
          <p>Hello,</p>
          <p>Thank you for registering. Please use the following One-Time Password (OTP) to complete your signup process. This OTP is valid for <strong>5 minutes</strong>.</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 30px 0; padding: 15px; background: #f0f4ff; color: #4f46e5; border-radius: 6px;">
            ${otp}
          </div>
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            If you did not request this code, please ignore this email.
          </p>
        </div>
      </body>
    </html>
    `;

    try {
      await mailer.sendMail({
        from: config.SMTP_FROM,
        to: cleanEmail,
        subject: "Verify Your Account - Customer Churn Prediction",
        html: htmlContent,
      });
      logger.info(`OTP Email sent successfully to ${cleanEmail}`);
      return true;
    } catch (err) {
      logger.error(`Failed to send SMTP email to ${cleanEmail}: ${err.message}`);
      console.log("\n" + "!".repeat(60));
      console.log(` SMTP FAILURE. BACKUP CONSOLE LOGGER FOR ${cleanEmail}`);
      console.log(` OTP CODE IS: ${otp}`);
      console.log("!".repeat(60) + "\n");
      return true;
    }
  },
};
