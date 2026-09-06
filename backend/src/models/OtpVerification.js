import mongoose from "mongoose";

const otpVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL Index: documents automatically removed at expires_at
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export const OtpVerification = mongoose.model(
  "OtpVerification",
  otpVerificationSchema,
  "otp_verifications"
);
