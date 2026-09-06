import axios from "axios";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

const client = axios.create({
  baseURL: config.ML_SERVICE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

const batchClient = axios.create({
  baseURL: config.ML_SERVICE_URL,
  timeout: 600000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const mlService = {
  /**
   * Health check to ML microservice.
   */
  async checkHealth() {
    try {
      const response = await client.get("/health");
      return response.data;
    } catch (err) {
      logger.error(`ML microservice health check failed: ${err.message}`);
      return { status: "unreachable", error: err.message };
    }
  },

  /**
   * Get feature columns from ML service.
   */
  async getColumns() {
    const response = await client.get("/columns");
    return response.data.columns;
  },

  /**
   * Single prediction + SHAP explanation.
   */
  async predictSingle(customerData, skipShap = false) {
    try {
      const response = await client.post("/predict", {
        customer_data: customerData,
        skip_shap: skipShap,
      });
      return response.data;
    } catch (err) {
      logger.error(`ML microservice /predict call failed: ${err.message}`);
      const msg = err.response?.data?.message || err.message;
      throw new Error(`ML Service Error: ${msg}`);
    }
  },

  /**
   * Batch predictions (vectorized).
   */
  async predictBatch(records) {
    try {
      const response = await batchClient.post("/predict/batch", {
        records,
      });
      return response.data;
    } catch (err) {
      logger.error(`ML microservice /predict/batch call failed: ${err.message}`);
      const msg = err.response?.data?.message || err.message;
      throw new Error(`ML Service Batch Error: ${msg}`);
    }
  },
};
