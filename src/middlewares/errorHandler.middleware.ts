// errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: err.success,
      message: err.message,
      errors: err.errors,
      data: err.data,
    });
  }

  // fallback for unhandled errors
  console.error(err); // for debugging
  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
    errors: [],
    data: null,
  });
};

export { errorHandler };
