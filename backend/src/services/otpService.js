import { OtpVerification } from "../models/OtpVerification.js";
import { emailService } from "./emailService.js";
import { logger } from "../utils/logger.js";

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const otpService = {
  /**
   * Checks if an email is on cooldown (60 seconds).
   */
  async checkResendCooldown(email) {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await OtpVerification.findOne({ email: cleanEmail });

    if (!existing || !existing.created_at) {
      return { canResend: true, remainingSeconds: 0 };
    }

    const elapsedMs = Date.now() - new Date(existing.created_at).getTime();
    if (elapsedMs < 60 * 1000) {
      const remainingSeconds = Math.ceil((60 * 1000 - elapsedMs) / 1000);
      return { canResend: false, remainingSeconds };
    }

    return { canResend: true, remainingSeconds: 0 };
  },

  /**
   * Generates, stores, and sends OTP.
   */
  async generateAndSendOtp(email) {
    const cleanEmail = email.trim().toLowerCase();
    const { canResend, remainingSeconds } = await this.checkResendCooldown(cleanEmail);

    if (!canResend) {
      return {
        success: false,
        message: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
      };
    }

    const otp = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    try {
      // Upsert OTP record
      await OtpVerification.deleteMany({ email: cleanEmail });
      await OtpVerification.create({
        email: cleanEmail,
        otp,
        attempts: 0,
        expires_at: expiresAt,
      });

      const sent = await emailService.sendOtpEmail(cleanEmail, otp);
      if (sent) {
        return { success: true, message: "Verification code sent to your email." };
      }
      return { success: false, message: "Failed to send verification email. Please try again." };
    } catch (err) {
      logger.error(`Error in generateAndSendOtp for ${cleanEmail}: ${err.message}`);
      return { success: false, message: "An unexpected error occurred. Please try again." };
    }
  },

  /**
   * Verifies the OTP code.
   */
  async verifyOtpCode(email, code) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    const record = await OtpVerification.findOne({
      email: cleanEmail,
      expires_at: { $gt: new Date() },
    });

    if (!record) {
      return {
        success: false,
        message: "OTP has expired or does not exist. Please request a new code.",
      };
    }

    if (record.attempts >= 5) {
      await OtpVerification.deleteMany({ email: cleanEmail });
      return {
        success: false,
        message: "Maximum verification attempts exceeded. Please request a new OTP.",
      };
    }

    // Increment attempts
    record.attempts += 1;
    await record.save();

    if (record.otp === cleanCode) {
      await OtpVerification.deleteMany({ email: cleanEmail });
      return { success: true, message: "Email verified successfully." };
    } else {
      const remaining = 5 - record.attempts;
      if (remaining <= 0) {
        await OtpVerification.deleteMany({ email: cleanEmail });
        return {
          success: false,
          message: "Too many incorrect attempts. This OTP has been invalidated.",
        };
      }
      return {
        success: false,
        message: `Invalid verification code. ${remaining} attempts remaining.`,
      };
    }
  },
};
