import mongoose from "mongoose";

const featureImpactSchema = new mongoose.Schema(
  {
    feature: { type: String, required: true },
    impact: { type: Number, required: true },
  },
  { _id: false }
);

const predictionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    prediction_type: {
      type: String,
      enum: ["single", "batch"],
      default: "single",
    },
    input_data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    prediction: {
      type: String,
      required: true,
    },
    probability: {
      type: Number,
      required: true,
    },
    risk_level: {
      type: String,
      enum: ["Low", "Medium", "High"],
      required: true,
    },
    business_summary: {
      type: String,
      default: "",
    },
    recommendations: {
      type: [String],
      default: [],
    },
    top_features: {
      type: [featureImpactSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Compound index for user history retrieval and stats sorting
predictionSchema.index({ user_id: 1, created_at: -1 });
predictionSchema.index({ user_id: 1, risk_level: 1 });
predictionSchema.index({ user_id: 1, prediction: 1 });

export const Prediction = mongoose.model("Prediction", predictionSchema, "prediction_history");
