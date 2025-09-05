import { Router } from "express";
import { uploadFile, getProjectFiles, getFileById } from "../controllers/file.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router({ mergeParams: true });

router.route("/upload-files").post(authenticate, uploadFile);
router.route("/get-project").get(authenticate, getProjectFiles);
router.route("/get-file").get(authenticate, getFileById);

export default router;
