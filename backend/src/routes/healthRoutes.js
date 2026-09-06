import { Router } from "express";
import mongoose from "mongoose";
import { mlService } from "../services/mlService.js";
import { predictionController } from "../controllers/predictionController.js";
import { isDemoMode } from "../config/db.js";

const router = Router();

router.get("/health", async (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const mlHealth = await mlService.checkHealth();

  const isHealthy = isMongoConnected && mlHealth.status === "healthy";

  return res.status(200).json({
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    database: isDemoMode()
      ? "mock_in_memory"
      : isMongoConnected
        ? "mongodb_connected"
        : "disconnected",
    ml_service: mlHealth,
  });
});

// Legacy backward-compatibility endpoint
router.get("/get_col", predictionController.getColumns);

export default router;
