import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import { User } from "../src/models/User.js";
import { Prediction } from "../src/models/Prediction.js";
import { generateJWT } from "../src/middleware/authMiddleware.js";

describe("Prediction & SHAP Explainability API", () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/churn_db_test");
    } catch (err) {}

    const user = await User.create({
      name: "Predict User",
      email: "predict.test@test.com",
      verified: true,
    });
    userId = String(user._id);
    authToken = generateJWT(user);
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: "predict.test@test.com" });
      await Prediction.deleteMany({ user_id: userId });
      await mongoose.disconnect();
    } catch (err) {}
  });

  const sampleCustomer = {
    gender: "Female",
    senior_citizen: "No",
    partner: "No",
    dependents: "No",
    tenure_months: 2,
    phone_service: "Yes",
    multiple_lines: "No",
    internet_service: "Fiber optic",
    online_security: "No",
    online_backup: "No",
    device_protection: "No",
    tech_support: "No",
    streaming_tv: "No",
    streaming_movies: "No",
    contract: "Month-to-month",
    paperless_billing: "Yes",
    payment_method: "Electronic check",
    monthly_charges: 70.7,
    total_charges: 151.65,
  };

  describe("Single Prediction & SHAP Analysis", () => {
    it("should execute single prediction with top SHAP feature impacts and business insights", async () => {
      const res = await request(app)
        .post("/api/prediction/predict")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ customer_data: sampleCustomer });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("prediction_id");
      expect(res.body).toHaveProperty("result");

      const result = res.body.result;
      expect(result).toHaveProperty("prediction");
      expect(result).toHaveProperty("probability");
      expect(result).toHaveProperty("risk_level");
      expect(result).toHaveProperty("business_summary");
      expect(result).toHaveProperty("recommendations");
      expect(result).toHaveProperty("top_features");
      expect(Array.isArray(result.top_features)).toBe(true);
      expect(result.top_features.length).toBeGreaterThan(0);

      // Verify MongoDB persistence
      const savedDoc = await Prediction.findById(res.body.prediction_id);
      expect(savedDoc).not.toBeNull();
      expect(savedDoc.user_id.toString()).toBe(userId);
    });

    it("should return 401 when token is missing", async () => {
      const res = await request(app)
        .post("/api/prediction/predict")
        .send({ customer_data: sampleCustomer });

      expect(res.status).toBe(401);
    });
  });

  describe("Prediction History & Filtering", () => {
    let predictionId;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/prediction/predict")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ customer_data: sampleCustomer });

      predictionId = res.body.prediction_id;
    });

    it("should retrieve paginated user prediction history", async () => {
      const res = await request(app)
        .get("/api/prediction/history?page=1&per_page=10")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("predictions");
      expect(res.body).toHaveProperty("total");
      expect(res.body.predictions.length).toBeGreaterThan(0);
    });

    it("should retrieve details of a specific prediction", async () => {
      const res = await request(app)
        .get(`/api/prediction/prediction/${predictionId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(predictionId);
      expect(res.body.input_data.gender).toBe("Female");
    });

    it("should retrieve aggregated dashboard analytics stats", async () => {
      const res = await request(app)
        .get("/api/prediction/stats")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total_predictions");
      expect(res.body).toHaveProperty("churn_percentage");
      expect(res.body).toHaveProperty("high_risk_customers");
      expect(res.body).toHaveProperty("most_influential_feature");
    });

    it("should delete a single prediction", async () => {
      const res = await request(app)
        .delete(`/api/prediction/prediction/${predictionId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("deleted successfully");

      const check = await Prediction.findById(predictionId);
      expect(check).toBeNull();
    });
  });
});
