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

// CloudFlare R2 configuration
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

// Helper function to get video duration
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

// Helper function to generate thumbnail for videos
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

// Upload file to CloudFlare R2
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

// Get file type based on mime type and upload context
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

//
