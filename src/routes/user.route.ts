import { Router } from "express";
import {
  refreshAccessToken,
  register,
  login,
  logout,
  verifyUser,
} from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.route("/refresh-token").post(refreshAccessToken);
router.route("/register").post(register);
router.route("/login").post(login);
router.route("/logout").post(authenticate, logout);
router.route("/verify").get(authenticate, verifyUser);

export default router;
