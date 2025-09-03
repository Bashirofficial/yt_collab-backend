import multer from "multer";
import { Request } from "express";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024,
  },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: any, acceptFile: boolean) => void
  ) => {
    const allowedMimeTypes = [
      "video/mp4",
      "video/avi",
      "video/mov",
      "video/mkv",
      "video/webm",
      "audio/mp3",
      "audio/wav",
      "audio/aac",
      "audio/m4a",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type!"), false);
    }
  },
}).single("file");
