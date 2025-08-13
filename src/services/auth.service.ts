// src/services/auth.service.ts
import prisma from "../db";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.util";
import { ApiError } from "../utils/ApiError";

export const generateAccessAndRefreshToken = async (userId: number) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "User not found");

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }, // store in DB for validation later
    });

    return { accessToken, refreshToken };
  } catch {
    throw new ApiError(
      500,
      "Something went wrong while generating Access and Refresh Token."
    );
  }
};
