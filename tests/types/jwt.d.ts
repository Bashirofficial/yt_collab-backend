import { JwtPayload } from "jsonwebtoken";

declare module "jsonwebtoken" {
  export interface JwtPayload {
    id?: string;
    userId?: string;
    email?: string;
    exp?: number;
    iat?: number;
  }
}

// Alternative approach: Create a custom JWT payload interface
export interface CustomJwtPayload extends JwtPayload {
  id: string;
  userId?: string;
  email: string;
  exp: number;
}

// Export for use in tests
export type MockJwtPayload = CustomJwtPayload;
