import { Request, Response, CookieOptions } from "express";
import { comparePassword, hashPassword } from "../utils/hash.util";
import jwt from "jsonwebtoken";
import prisma from "../db";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { AsyncHandler } from "../utils/AsyncHandler";
import { generateAccessAndRefreshToken } from "../services/auth.service";

//--------- Controllers (C) ---------//

// C1. Refresh access token endpoint
const refreshAccessToken = AsyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    ) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.id },
    });

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: incomingRefreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.token !== incomingRefreshToken) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(storedToken.user.id);

    const options: CookieOptions = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
});

// C2. Register as an Editor
const register = AsyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw new ApiError(400, "Invalid Email format");
  }

  if ([name, email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ApiError(403, "User already exists");
  }
  const hashedPassword = await hashPassword(password);

  const createdUser = await prisma.user.create({
    data: { name, email, password: hashedPassword, role },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered Successfully"));
});

// C3. Login as an Editor
const login = AsyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.password) {
    throw new ApiError(401, "Invalid credentials");
  }
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user.id
  );

  const options: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Only secure in production
    sameSite: "strict",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user,
          accessToken,
          refreshToken,
        },
        "User logged in Successfully"
      )
    );
});

// C4. Logout as an Editor
const logout = AsyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: User not authenticated.");
  }

  const authenticatedReq = req as Request & {
    user: { id: string; email: string; role: any };
  };

  await prisma.refreshToken.deleteMany({
    where: { userId: authenticatedReq.user.id },
  });

  const options: CookieOptions = {
    //secure as this cookie can only be modified from server
    httpOnly: true,
    secure: true,
    path: "/",
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(201, {}, "User logged out Successfully"));
});

const verifyUser = AsyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!user) {
    throw new ApiError(401, "Unauthorized: User not authenticated");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "User verified successfully"));
});
export { refreshAccessToken, register, login, logout, verifyUser };
