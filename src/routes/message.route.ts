import { Router } from "express";
import {
  sendMessage,
  getProjectMessages,
  markMessagesAsRead,
  getMessageById,
  deleteMessage,
  //getMessageStats,
  searchMessages,
} from "../controllers/message.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validateMessage } from "../middlewares/validation.middleware";
const router = Router({ mergeParams: true });

router
  .route("/projects/:projectId/messages")
  .post(authenticate, validateMessage, sendMessage);

router
  .route("/projects/:projectId/messages")
  .get(authenticate, getProjectMessages);

router
  .route("/projects/:projectId/messages/read")
  .patch(authenticate, markMessagesAsRead);

router.route("/messages/:messageId").get(authenticate, getMessageById);

router.route("/messages/:messageId").delete(authenticate, deleteMessage);

router
  .route("/projects/:projectId/messages/search")
  .get(authenticate, searchMessages);

export default router;
