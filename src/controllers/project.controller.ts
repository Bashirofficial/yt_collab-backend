import { Request, Response } from "express";
import prisma from "../db";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { AsyncHandler } from "../utils/AsyncHandler";
import generateProjectCode from "../utils/generateProjectCode";

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
  if (req.user.role !== "YOUTUBER") {
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

const getProject = AsyncHandler(async (req: Request, res: Response) => {
  const { projectDisplayId } = req.params;

  if (!req.user) {
    throw new ApiError(401, "Unauthorized: User not authenticated.");
  }

  const project = await prisma.project.findUnique({
    where: { projectDisplayId },
    include: {
      permissions: true,
      youtuber: {
        select: { id: true, name: true, email: true, role: true },
      },
      editor: {
        select: { id: true, name: true, email: true, role: true },
      },
      files: {
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          fileType: true,
          uploadedAt: true,
        },
      },
    },
  });

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Check access permissions
  const canAccess =
    project.youtuberId === req.user.id || // Project owner
    project.editorId === req.user.id; // Assigned editor

  if (!canAccess) {
    throw new ApiError(
      403,
      "Access denied: You don't have permission to view this project"
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project retrieved successfully"));
});

const editProject = AsyncHandler(async (req: Request, res: Response) => {
  const { projectDisplayId } = req.params;
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
    status,
    progress,
    fullAccess,
    uploadAccess,
    downloadAccess,
    shareAccess,
  } = req.body;

  if (!req.user) {
    throw new ApiError(401, "Unauthorized: User not authenticated.");
  }

  const existingProject = await prisma.project.findUnique({
    where: { projectDisplayId },
    include: { permissions: true },
  });

  if (!existingProject) {
    throw new ApiError(404, "Project not found");
  }

  if (
    req.user.role !== "YOUTUBER" &&
    req.user.id !== existingProject.youtuberId
  ) {
    if (visibility !== undefined || instructions !== undefined) {
      throw new ApiError(
        403,
        "Access denied: Only project owner can modify visibility and instructions"
      );
    }
  }

  try {
    // ✅ Use transaction to update both project and permissions atomically
    const result = await prisma.$transaction(async (tx) => {
      // Build project update data
      const updateData: any = {};

      if (title !== undefined) updateData.title = title;
      if (videoTitle !== undefined) updateData.videoTitle = videoTitle;
      if (description !== undefined) updateData.description = description;
      if (videoDescription !== undefined)
        updateData.videoDescription = videoDescription;
      if (keywords !== undefined) updateData.keywords = keywords || [];
      if (visibility !== undefined) updateData.visibility = visibility;
      if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
      if (instructions !== undefined) updateData.instructions = instructions;
      if (projectType !== undefined) updateData.projectType = projectType;
      if (status !== undefined) updateData.status = status;
      if (progress !== undefined) {
        if (progress < 0 || progress > 100) {
          throw new ApiError(400, "Progress must be between 0 and 100");
        }
        updateData.progress = progress;
      }
      if (dueDate !== undefined) {
        updateData.dueDate = dueDate ? new Date(dueDate) : null;
      }

      // Update project if there's data to update
      if (Object.keys(updateData).length > 0) {
        await tx.project.update({
          where: { id: existingProject.id },
          data: updateData,
        });
      }

      // Update permissions if provided (only project owner can do this)
      const hasPermissionUpdates =
        fullAccess !== undefined ||
        uploadAccess !== undefined ||
        downloadAccess !== undefined ||
        shareAccess !== undefined;

      if (hasPermissionUpdates && existingProject.youtuberId === req.user!.id) {
        await tx.projectPermission.update({
          where: { projectId: existingProject.id },
          data: {
            ...(fullAccess !== undefined && { fullAccess }),
            ...(uploadAccess !== undefined && { uploadAccess }),
            ...(downloadAccess !== undefined && { downloadAccess }),
            ...(shareAccess !== undefined && { shareAccess }),
          },
        });
      }

      // Return the updated project with all related data
      return await tx.project.findUnique({
        where: { id: existingProject.id },
        include: {
          permissions: true,
          youtuber: {
            select: { id: true, name: true, email: true, role: true },
          },
          editor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, result, "Project has been successfully updated")
      );
  } catch (error: any) {
    throw error;
  }
});

export { createProject, getProject, editProject };
