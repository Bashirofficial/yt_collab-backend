import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

export const validateMessage = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { content, messageType, fileUrl, fileName } = req.body;

  // Content validation
  if (!content || typeof content !== "string") {
    throw new ApiError(400, "Message content is required and must be a string");
  }

  if (content.trim().length === 0) {
    throw new ApiError(400, "Message content cannot be empty");
  }

  if (content.length > 2000) {
    throw new ApiError(400, "Message content cannot exceed 2000 characters");
  }

  // Message type validation
  const validMessageTypes = ["TEXT", "FILE", "SYSTEM", "NOTIFICATION"];
  if (messageType && !validMessageTypes.includes(messageType)) {
    throw new ApiError(400, "Invalid message type");
  }

  // File message validation
  if (messageType === "FILE") {
    if (!fileUrl || typeof fileUrl !== "string") {
      throw new ApiError(400, "File URL is required for file messages");
    }

    if (!fileName || typeof fileName !== "string") {
      throw new ApiError(400, "File name is required for file messages");
    }

    // Validate file URL format (basic check)
    try {
      new URL(fileUrl);
    } catch {
      throw new ApiError(400, "Invalid file URL format");
    }
  }

  // Sanitize content
  req.body.content = content.trim();

  next();
};
