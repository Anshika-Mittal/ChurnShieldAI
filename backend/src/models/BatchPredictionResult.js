import mongoose from "mongoose";

const featureImpactSchema = new mongoose.Schema(
  {
    feature: { type: String, required: true },
    impact: { type: Number, required: true },
  },
  { _id: false }
);

const batchPredictionResultSchema = new mongoose.Schema(
  {
    batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BatchJob",
      required: true,
      index: true,
    },
    customer_number: {
      type: String,
      required: true,
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
    top_features: {
      type: [featureImpactSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export const BatchPredictionResult = mongoose.model(
  "BatchPredictionResult",
  batchPredictionResultSchema,
  "batch_prediction_results"
);
