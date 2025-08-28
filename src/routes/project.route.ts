import { Router } from "express";
import {
  createProject,
  getProject,
  editProject,
} from "../controllers/project.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.route("/create-project").post(authenticate, createProject);
router.route("/get-project").get(authenticate, getProject);
router.route("/edit-project").post(authenticate, editProject);

export default router;
