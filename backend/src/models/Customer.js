import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customer_id: {
      type: String,
      required: true,
      trim: true,
    },
    gender: { type: String, default: "Male" },
    senior_citizen: { type: String, default: "No" },
    partner: { type: String, default: "No" },
    dependents: { type: String, default: "No" },
    tenure_months: { type: Number, default: 0 },
    phone_service: { type: String, default: "Yes" },
    multiple_lines: { type: String, default: "No" },
    internet_service: { type: String, default: "DSL" },
    online_security: { type: String, default: "No" },
    online_backup: { type: String, default: "No" },
    device_protection: { type: String, default: "No" },
    tech_support: { type: String, default: "No" },
    streaming_tv: { type: String, default: "No" },
    streaming_movies: { type: String, default: "No" },
    contract: { type: String, default: "Month-to-month" },
    paperless_billing: { type: String, default: "Yes" },
    payment_method: { type: String, default: "Electronic check" },
    monthly_charges: { type: Number, default: 0.0 },
    total_charges: { type: Number, default: 0.0 },
    last_prediction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prediction",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Compound index for user and customer identifier
customerSchema.index({ user_id: 1, customer_id: 1 }, { unique: true });

export const Customer = mongoose.model("Customer", customerSchema, "customers");
