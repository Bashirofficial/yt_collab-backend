import jwt, { SignOptions } from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "";
const ACCESS_EXPIRES = process.env
  .JWT_ACCESS_EXPIRES as SignOptions["expiresIn"];
const REFRESH_EXPIRES = process.env
  .JWT_REFRESH_EXPIRES as SignOptions["expiresIn"];

export const generateAccessToken = (userId: string, role: string) => {
  if (!ACCESS_TOKEN_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET is not defined.");
  }

  return jwt.sign({ userId, role }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });
};

export const generateRefreshToken = (userId: string, role: string) => {
  if (!REFRESH_TOKEN_SECRET) {
    throw new Error("REFRESH_TOKEN_SECRET is not defined.");
  }

  return jwt.sign({ userId, role }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};
