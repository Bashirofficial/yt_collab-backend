import { Request, Response, CookieOptions } from "express";
import prisma from "../db";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { AsyncHandler } from "../utils/AsyncHandler";
import { customAlphabet } from "nanoid";

const generateProjectCode = () => {
  const nanoid = customAlphabet("1234567890ABCDEF", 8);
  return `PROJ_${nanoid()}`;
};

const createProject = AsyncHandler(async (req: Request, res: Response) => {
  const {
    title,
    videoTitle,
    description,
    videoDescription,
    keywords,
    visibility,
    thumbnail,
    instructions,
    projectType,
    dueDate,
    fullAccess,
    uploadAccess,
    downloadAccess,
    shareAccess,
  } = req.body;

  if (!req.user) {
    throw new ApiError(401, "Unauthorized: User not authenticated.");
  }
  if (!req.user.role !== "YOUTUBER") {
    throw new ApiError(
      403,
      "Access denied: Only YouTubers can create projects"
    );
  }

  if (!title || !videoTitle) {
    throw new ApiError(400, "Title and video title are required");
  }

  const project = await prisma.project.create({
    data: {
      title,
      projectDisplayId: generateProjectCode(),
      videoTitle,
      description,
      videoDescription,
      keywords: keywords || [],
      visibility: visibility || "PUBLIC",
      thumbnail,
      instructions,
      projectType: projectType || "SINGLE",
      dueDate: dueDate ? new Date(dueDate) : null,
      youtuberId: req.user!.id,
      // Create permissions using nested create
      permissions: {
        create: {
          fullAccess: fullAccess ?? true,
          uploadAccess: uploadAccess ?? true,
          downloadAccess: downloadAccess ?? true,
          shareAccess: shareAccess ?? false,
        },
      },
    },
    include: {
      permissions: true,
      youtuber: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return res
    .status(201)
    .json(
      new ApiResponse(200, project, "New project has been successully created")
    );
});

export { createProject };
