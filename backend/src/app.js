import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import predictionRoutes from "./routes/predictionRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("trust proxy", 1);

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS Configuration
app.use(
  cors({
    origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(","),
    credentials: true,
  })
);

// Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP Request Logger
if (config.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Local profile-image fallback when AWS S3 is not configured
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// Global API Rate Limiting
app.use("/api", apiLimiter);

// Register Routes
app.use("/api/auth", authRoutes);
app.use("/api/prediction", predictionRoutes);
app.use("/api/predictions", predictionRoutes); // Alias for RESTful plural conventions
app.use("/api/customers", customerRoutes);
app.use("/api", healthRoutes);
app.use("/", healthRoutes); // Handles legacy GET /get_col

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Resource not found" });
});

// Global Error Handler
app.use(errorHandler);

export default app;
