import { Router } from "express";
import {
  createProject,
  getProject,
  getProjectIds,
  editProject,
} from "../controllers/project.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router({ mergeParams: true });

router.route("/create-project").post(authenticate,  createProject);
router.route("/get-project/:projectDisplayId").get(authenticate, getProject);
router.route("/get-project-id").get(authenticate, getProjectIds)
router.route("/edit-project").post(authenticate, editProject);

export default router;
