import mongoose from "mongoose";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

let isConnected = false;
let isDemo = false;

export function isDemoMode() {
  return isDemo || config.DEMO_MODE;
}

export async function connectDB(uri = config.MONGO_URI) {
  if (isConnected) {
    return mongoose.connection;
  }

  if (config.DEMO_MODE) {
    logger.warn("DEMO_MODE is enabled. Attempting MongoDB, then in-memory fallback if unavailable.");
  }

  try {
    logger.info(`Connecting to MongoDB at ${uri}...`);
    const db = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: config.DEMO_MODE ? 3000 : 8000,
      autoIndex: true,
    });
    isConnected = true;
    isDemo = false;
    logger.info("MongoDB connected successfully via Mongoose.");

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      logger.warn("MongoDB disconnected.");
    });
    mongoose.connection.on("reconnected", () => {
      isConnected = true;
      logger.info("MongoDB reconnected.");
    });

    return db.connection;
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);

    if (config.DEMO_MODE || config.NODE_ENV !== "production") {
      try {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        logger.warn("Starting in-memory MongoDB (demo / local fallback). Data will not persist.");
        const mem = await MongoMemoryServer.create();
        const memUri = mem.getUri("churn_db");
        const db = await mongoose.connect(memUri, { autoIndex: true });
        isConnected = true;
        isDemo = true;
        logger.info("In-memory MongoDB ready.");
        return db.connection;
      } catch (memErr) {
        logger.error(`In-memory MongoDB fallback failed: ${memErr.message}`);
      }
    }

    throw err;
  }
}

export async function disconnectDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info("MongoDB disconnected.");
  }
}
