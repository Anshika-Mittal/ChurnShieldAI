import mongoose from "mongoose";

const batchJobSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    file_name: {
      type: String,
      required: true,
    },
    total_records: {
      type: Number,
      default: 0,
    },
    processed_records: {
      type: Number,
      default: 0,
    },
    failed_records: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PROCESSING",
      index: true,
    },
    error: {
      type: String,
      default: null,
    },
    summary: {
      churn_count: { type: Number, default: 0 },
      stay_count: { type: Number, default: 0 },
      high_risk: { type: Number, default: 0 },
      medium_risk: { type: Number, default: 0 },
      low_risk: { type: Number, default: 0 },
    },
    completed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

batchJobSchema.index({ user_id: 1, created_at: -1 });

export const BatchJob = mongoose.model("BatchJob", batchJobSchema, "batch_predictions");
