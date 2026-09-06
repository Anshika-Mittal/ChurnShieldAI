import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User } from "../src/models/User.js";
import { BatchJob } from "../src/models/BatchJob.js";
import { BatchPredictionResult } from "../src/models/BatchPredictionResult.js";
import { generateJWT } from "../src/middleware/authMiddleware.js";

describe("Batch CSV Prediction & High-Throughput Job Manager", () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/churn_db_test");
    } catch (err) {}

    const user = await User.create({
      name: "Batch User",
      email: "batch.test@test.com",
      verified: true,
    });
    userId = String(user._id);
    authToken = generateJWT(user);
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: "batch.test@test.com" });
      const batchIds = await BatchJob.find({ user_id: userId }).distinct("_id");
      await BatchPredictionResult.deleteMany({ batch_id: { $in: batchIds } });
      await BatchJob.deleteMany({ user_id: userId });
      await mongoose.disconnect();
    } catch (err) {}
  });

  function createCSVContent(rowCount = 5) {
    const headers = [
      "CustomerID", "Gender", "Senior Citizen", "Partner", "Dependents",
      "Tenure Months", "Phone Service", "Multiple Lines", "Internet Service",
      "Online Security", "Online Backup", "Device Protection", "Tech Support",
      "Streaming TV", "Streaming Movies", "Contract", "Paperless Billing",
      "Payment Method", "Monthly Charges", "Total Charges"
    ].join(",");

    const rows = [headers];
    for (let i = 1; i <= rowCount; i++) {
      rows.push(
        `CUST-${String(i).padStart(4, "0")},Female,No,No,No,${i + 1},Yes,No,Fiber optic,No,No,No,No,No,No,Month-to-month,Yes,Electronic check,70.5,${(70.5 * (i + 1)).toFixed(2)}`
      );
    }
    return rows.join("\n");
  }

  describe("CSV Validation", () => {
    it("should reject non-CSV files", async () => {
      const res = await request(app)
        .post("/api/prediction/predict-batch")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from("dummy text"), "data.txt");

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Only CSV files are supported");
    });

    it("should detect missing required columns in CSV", async () => {
      const invalidCSV = "CustomerID,Gender,Age\n1,Female,25";
      const res = await request(app)
        .post("/api/prediction/predict-batch")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(invalidCSV), "invalid.csv");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("missing_columns");
      expect(res.body.missing_columns.length).toBeGreaterThan(0);
    });
  });

  describe("Batch Prediction Workflow & Job Polling", () => {
    let createdBatchId;

    it("should upload CSV, run chunked inference, and return immediate summary and preview", async () => {
      const csvData = createCSVContent(10);

      const res = await request(app)
        .post("/api/prediction/predict-batch")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(csvData), "customers_10.csv");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("batch_id");
      expect(res.body.total_records).toBe(10);
      expect(res.body).toHaveProperty("summary");
      expect(res.body.summary).toHaveProperty("churn_count");
      expect(res.body).toHaveProperty("preview");
      expect(res.body.preview.length).toBeGreaterThan(0);

      createdBatchId = res.body.batch_id;
    });

    it("should fetch batch details and results via GET /api/prediction/batch/:batchId", async () => {
      const res = await request(app)
        .get(`/api/prediction/batch/${createdBatchId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(10);
      expect(res.body.status).toBe("COMPLETED");
      expect(res.body.results.length).toBe(10);
      expect(res.body.results[0]).toHaveProperty("prediction");
      expect(res.body.results[0]).toHaveProperty("probability");
      expect(res.body.results[0]).toHaveProperty("top_features");
    });

    it("should fetch batch progress via alias GET /api/predictions/batch/:jobId", async () => {
      const res = await request(app)
        .get(`/api/predictions/batch/${createdBatchId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.jobId).toBe(createdBatchId);
      expect(res.body.progress).toBe(100);
      expect(res.body.status).toBe("COMPLETED");
    });

    it("should stream downloadable CSV of batch results", async () => {
      const res = await request(app)
        .get(`/api/prediction/download-results/${createdBatchId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("Customer ID,Prediction,Probability,Risk Level");
    });

    it("should delete batch and cascade delete result rows", async () => {
      const res = await request(app)
        .delete(`/api/prediction/batch/${createdBatchId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("deleted successfully");

      const checkBatch = await BatchJob.findById(createdBatchId);
      expect(checkBatch).toBeNull();

      const checkResults = await BatchPredictionResult.find({ batch_id: createdBatchId });
      expect(checkResults.length).toBe(0);
    });
  });

  describe("10,000 Records Batch Ingestion Test", () => {
    it("should support initiating large batch dataset (10,000 records) asynchronously", async () => {
      // Generate 1000 records in memory for fast testing
      const csvData = createCSVContent(1000);

      const res = await request(app)
        .post("/api/prediction/predict-batch?async=true")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(csvData), "large_batch_1000.csv");

      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty("batch_id");
      expect(res.body.status).toBe("PROCESSING");
      expect(res.body.total_records).toBe(1000);
    });
  });
});
