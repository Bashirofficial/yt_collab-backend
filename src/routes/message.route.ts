import { Router } from "express";
import { sendMessage } from "../controllers/message.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validateMessage } from "../middlewares/validation.middleware";
const router = Router({ mergeParams: true });

router
  .route("/projects/:projectId/messages")
  .post(authenticate, validateMessage, sendMessage);

export default router;
