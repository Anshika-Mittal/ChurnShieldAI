import rateLimit from "express-rate-limit";
import { config } from "../config/env.js";

const skipInTest = () => config.NODE_ENV === "test";

// Auth rate limiter to prevent brute force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    message: "Too many authentication attempts. Please try again later.",
  },
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    message: "Too many requests. Please slow down.",
  },
});
