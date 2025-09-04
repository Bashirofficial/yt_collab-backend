import { Request, Response } from "express";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import prisma from "../db";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { AsyncHandler } from "../utils/AsyncHandler";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { upload } from "../middlewares/multer.middleware";
import multer from "multer";

//--------- CloudFlare R2 configuration ---------//
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT as string,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID! as string,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY as string,
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

//--------- Helper Functions (H) ---------//
// H1. Helper function to get video duration
const getVideoDuration = (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(__dirname, `temp_${uuidv4()}`);
    fs.writeFileSync(tempPath, buffer);

    ffmpeg.ffprobe(tempPath, (err, metadata) => {
      fs.unlinkSync(tempPath);
      if (err) {
        reject(err);
        return;
      }

      const duration = metadata?.format?.duration;
      if (duration) {
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = Math.floor(duration % 60);
        resolve(
          `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      } else {
        resolve("00:00:00)");
      }
    });
  });
};

// H2. Helper function to generate thumbnail for videos
const generateThumbnail = (buffer: Buffer): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const tempInputPath = path.join(__dirname, `temp_input_${uuidv4()}`);
    const tempOutputPath = path.join(__dirname, `temp_output_${uuidv4()}.png`);
    fs.writeFileSync(tempInputPath, buffer);

    ffmpeg(tempInputPath)
      .screenshots({
        timestamps: ["50%"],
        filename: path.basename(tempOutputPath),
        folder: path.dirname(tempOutputPath),
        size: "1280x720",
      })
      .on("end", () => {
        try {
          const thumbnailBuffer = fs.readFileSync(tempOutputPath);
          fs.unlinkSync(tempInputPath);
          fs.unlinkSync(tempOutputPath);
          resolve(thumbnailBuffer);
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (err) => {
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        reject(err);
      });
  });
};

// H3. Upload file to CloudFlare R2
const uploadToR2 = async (
  buffer: Buffer,
  fileName: string,
  mimetype: string,
  projectId: string
): Promise<string> => {
  const key = `projects/${projectId}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    ContentLength: buffer.length,
  });

  await r2Client.send(command);
  return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
};

// H4. Get file type based on mime type and upload context
const determineFileType = (
  mimeType: string,
  isEdited: boolean = false,
  isFinal: boolean = false
) => {
  if (isFinal) return "FINAL";
  if (isEdited) return "EDITED";
  if (mimeType.startsWith("image/")) return "THUMBNAIL";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (mimeType.startsWith("video/")) return "RAW";
  return "OTHER";
};

//--------- Controllers (C) ---------//

// C1. Upload file endpoint
const uploadFile = AsyncHandler(async (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      throw new ApiError(400, `Upload error: ${err.message}`);
    } else if (err) {
      throw new ApiError(400, err.message);
    }

    if (!req.file) {
      throw new ApiError(400, "No file uploaded");
    }

    const { projectId } = req.params;
    console.log("Params:", req.params);
    const { version, isEdited = false, isFinal = false } = req.body;
    const uploaderId = req.user?.id;

    if (!uploaderId) {
      throw new ApiError(401, "User not authenticated");
    }

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: { projectDisplayId: projectId },
    });

    if (!project) {
      throw new ApiError(404, "Project not found or access denied");
    }

    try {
      const file = req.file;
      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const fileType = determineFileType(file.mimetype, isEdited, isFinal);

      // Uploading main file to R2
      const fileUrl = await uploadToR2(
        file.buffer,
        fileName,
        file.mimetype,
        projectId
      );

      let duration: string | null = null;
      let thumbnailUrl: string | null = null;

      //Process video files
      if (file.mimetype.startsWith("video/")) {
        try {
          duration = await getVideoDuration(file.buffer);
          const thumbnailBuffer = await generateThumbnail(file.buffer);
          const thumbnailFileName = `${uuidv4()}_thumbnail.png`;
          thumbnailUrl = await uploadToR2(
            thumbnailBuffer,
            thumbnailFileName,
            "image/png",
            projectId
          );
        } catch (error) {
          console.warn("Failed to process video metadata: ", error);
          duration = null;
          thumbnailUrl = null;
        }
      }

      const savedFile = await prisma.file.create({
        data: {
          projectId: project.id,
          uploaderId,
          fileType,
          fileUrl,
          fileName: file.originalname,
          fileSize: BigInt(file.size),
          mimeType: file.mimetype,
          duration,
          version,
          status: "UPLOADED",
          thumbnailUrl,
          metadata: {
            originalFileName: file.originalname,
            uploadedFrom: req.ip,
            userAgent: req.get("User-Agent"),
          },
        },
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      /*  const sanitizedFile = {
        ...savedFile,
        fileSize: savedFile.fileSize.toString(),
      };*/

      return res
        .status(201)
        .json(new ApiResponse(201, savedFile, "File uploaded successfully"));
    } catch (error) {
      console.error("File upload error: ", error);
      throw new ApiError(500, "Failed to upload file");
    }
  });
});

// C2. Get files for a project
const getProjectFiles = AsyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { fileType, status, page = 1, limit = 20 } = req.query;
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }

  const project = await prisma.project.findFirst({
    where: {
      projectDisplayId: projectId,
    },
  });

  if (!project) {
    throw new ApiError(404, "Project not found or access denied");
  }

  const whereClause: any = { projectId: project.id };

  if (fileType && typeof fileType === "string") {
    whereClause.fileType = fileType.toUpperCase();
  }

  if (status && typeof status === "string") {
    whereClause.status = status.toUpperCase();
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [files, totalCount] = await Promise.all([
    prisma.file.findMany({
      where: whereClause,
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.file.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(totalCount / Number(limit));

  const serializedFiles = files.map((file) => ({
    ...file,
    fileSize: file.fileSize.toString(),
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        serializedFiles,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1,
        },
      },
      "Files retrieved successfully"
    )
  );
});

export { uploadFile, getProjectFiles };
