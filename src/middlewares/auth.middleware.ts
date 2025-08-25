import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import prisma from "../db";
import { AsyncHandler } from "../utils/AsyncHandler";

export const authenticate = AsyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token =
      req.header("Authorization")?.replace("Bearer ", "") ||
      req.cookies?.accessToken;

    console.log("🔍 Token from header:", req.header("Authorization"));
    console.log("🔍 Token from cookies:", req.cookies?.accessToken);
    console.log("🔍 Final token:", token);

    if (!token) {
      throw new ApiError(401, "No Token provided");
    }

    try {
      console.log(
        "🔑 ACCESS_TOKEN_SECRET exists:",
        !!process.env.ACCESS_TOKEN_SECRET
      );

      const decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET as string
      ) as { userId: string };

      console.log("✅ Decoded token:", decoded);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      console.log("👤 User found:", !!user);

      if (!user) {
        throw new ApiError(401, "Invalid Access Token!");
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      next();
    } catch (error) {
      console.error("❌ JWT Error:", error);
      throw new ApiError(401, "Invalid token!");
    }
  }
);
