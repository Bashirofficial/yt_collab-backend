// middlewares/rateLimiter.middleware.ts
import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError";

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export const rateLimiter = (options: RateLimiterOptions) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || "Too many requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new ApiError(429, options.message || "Rate limit exceeded");
    },
    keyGenerator: (req) => {
      // Rate limit per user per project
      return `${req.user?.id}-${req.params.projectId}`;
    },
  });
};
