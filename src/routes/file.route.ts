import { Router } from "express";
import {
  uploadFile,
  getProjectFiles,
  getFileById,
  generateFileSignedUrl,
  updateFileStatus,
  deleteFile,
} from "../controllers/file.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router({ mergeParams: true });

router.route("/upload-files").post(authenticate, uploadFile);
router.route("/get-project").get(authenticate, getProjectFiles);
router.route("/get-file").get(authenticate, getFileById);
router.route("/get-file-url").get(authenticate, generateFileSignedUrl);
router.route("/update-file-status").post(authenticate, updateFileStatus);
router.route("/delete-file").post(authenticate, deleteFile);

export default router;
