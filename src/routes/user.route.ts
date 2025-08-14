import { Router } from "express";
import {
  refreshAccessToken,
  register,
  login,
  logout,
} from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.route("/refresh-token").post(refreshAccessToken);
router.route("/register").post(register);
router.route("/login").post(login);
router.route("/logout").post(authenticate, logout);

export default router;
