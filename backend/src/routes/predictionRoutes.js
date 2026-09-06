import { Router } from "express";
import { predictionController } from "../controllers/predictionController.js";
import { batchController } from "../controllers/batchController.js";
import { statsController } from "../controllers/statsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { uploadCSV } from "../middleware/uploadMiddleware.js";

const router = Router();

router.use(authenticateToken);

// Single Prediction
router.post("/predict", predictionController.predictSingle);

// Batch CSV Prediction & Job Management
router.post("/predict-batch", uploadCSV.single("file"), batchController.predictBatch);
router.post("/batch", uploadCSV.single("file"), batchController.predictBatch);
router.get("/batch/:batchId", batchController.getBatch);
router.delete("/batch/:batchId", batchController.deleteBatch);
router.get("/download-results/:batchId", batchController.downloadResults);

// History & Aggregation Analytics
router.get("/history", predictionController.getHistory);
router.get("/prediction/:id", predictionController.getPredictionDetails);
router.delete("/prediction/:id", predictionController.deleteSinglePrediction);
router.delete("/predictions", predictionController.clearAllPredictions);
router.get("/stats", statsController.getDashboardStats);

export default router;
