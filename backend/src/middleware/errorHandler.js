import { logger } from "../utils/logger.js";
import multer from "multer";

export function errorHandler(err, req, res, next) {
  logger.error(`Error processing ${req.method} ${req.url}: ${err.message}`, { stack: err.stack });

  // Handle Multer errors (e.g. file size exceeded)
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File size exceeds the allowed limit (5 MB for images, 50 MB for CSV).",
      });
    }
    return res.status(400).json({ message: `File upload error: ${err.message}` });
  }

  // Handle File filter or validation errors
  if (
    err.name === "ValidationError" ||
    err.message.includes("Invalid file format") ||
    err.message.includes("Only JPG, JPEG, and PNG") ||
    err.message.includes("Only CSV files")
  ) {
    return res.status(400).json({ message: err.message });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}
