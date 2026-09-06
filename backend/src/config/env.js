import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend or root directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  
  // Python ML Microservice URL
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || "http://localhost:5001",
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET_KEY || process.env.JWT_SECRET || "your-jwt-secret-key-change-it",
  SECRET_KEY: process.env.SECRET_KEY || "your-super-secret-key-change-it",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",
  
  // MongoDB
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/churn_db",
  DEMO_MODE: process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === "1",
  
  // AWS S3
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_REGION: process.env.AWS_REGION || "us-east-1",
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || "",
  
  // Email SMTP
  SMTP_SERVER: process.env.SMTP_SERVER || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || "",
  SMTP_FROM: process.env.SMTP_FROM || "no-reply@churnpredict.com",
  
  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  
  // Public URL used for locally stored profile images when S3 is unset
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || `http://localhost:${parseInt(process.env.PORT || "5000", 10)}`,

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*"
};
