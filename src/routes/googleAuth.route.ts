import passport from "../controllers/googleAuth.controller";
import { Router } from "express";
import { generateAccessAndRefreshToken } from "../services/auth.service";
import { CookieOptions } from "express";

const router = Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req: any, res) => {
    try {
      // Generate both access and refresh tokens (consistent with regular login)
      const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        req.user.id
      );

      const options: CookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      };

      // Set cookies and redirect (consistent with regular login)
      return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .redirect(
          process.env.CLIENT_SUCCESS_URL || "http://localhost:3000/dashboard"
        ); // Redirect to frontend
      // Or if you prefer JSON response:
      // .json(new ApiResponse(200, { user: req.user, accessToken, refreshToken }, "Google login successful"));
    } catch (error) {
      return res.redirect("/login?error=auth_failed");
    }
  }
);

export default router;
