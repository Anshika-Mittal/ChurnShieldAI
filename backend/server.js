import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { config } from "./src/config/env.js";
import { logger } from "./src/utils/logger.js";
import { mlService } from "./src/services/mlService.js";

async function startServer() {
  try {
    logger.info("Initializing Node.js Application Backend layers...");

    // Connect to MongoDB
    try {
      await connectDB();
    } catch (dbErr) {
      logger.warn(`Initial MongoDB connection failed: ${dbErr.message}. Retrying on background requests.`);
    }

    // Verify ML microservice availability
    const mlHealth = await mlService.checkHealth();
    logger.info(`Python ML microservice status: ${JSON.stringify(mlHealth)}`);

    const server = app.listen(config.PORT, () => {
      logger.info(`Node.js + Express Backend running on port ${config.PORT} [${config.NODE_ENV}]`);
    });
    server.timeout = 10 * 60 * 1000;
    server.keepAliveTimeout = 65 * 1000;

    // Graceful Shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Gracefully shutting down...`);
      server.close(() => {
        logger.info("HTTP server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
}

startServer();
