import { Request, Response } from "express";
import prisma from "../db";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { AsyncHandler } from "../utils/AsyncHandler";
import generateProjectCode from "../utils/generateProjectCode";
import { upload } from "../middlewares/multer.middleware";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { uploadToR2, deleteFromR2 } from "../utils/r2.util";
import path from "path";
//--------- Controllers (C) ---------//

// C1. Create a new project
const createProject = AsyncHandler(async (req: Request, res: Response) => {

  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      throw new ApiError(400, `Error occured while uploading thumbnail: ${err.message}`)
    }
    
    const {
      title,
      videoTitle,
      description,
      videoDescription,
      keywords,
      visibility,
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
  
  const ProjectId: string = generateProjectCode();
  let thumbnailUrl: string | null = null;
  if (req.file && req.file.mimetype.startsWith("image/")) {
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `thumbnail_${uuidv4()}${fileExtension}`
    
    thumbnailUrl = await uploadToR2(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      ProjectId
    )
  }
  
  const fullAccessBool =
  fullAccess === undefined ? true : String(fullAccess) === "true";
  const uploadAccessBool =
  uploadAccess === undefined ? true : String(uploadAccess) === "true";
  const downloadAccessBool =
    downloadAccess === undefined ? true : String(downloadAccess) === "true";
    const shareAccessBool =
    shareAccess === undefined ? false : String(shareAccess) === "true";
    
    const project = await prisma.project.create({
    data: {
      title,
      projectDisplayId: ProjectId,
      videoTitle,
      description,
      videoDescription,
      keywords: keywords ? keywords.split(',').map((k: string) => k.trim()) :  [],
      visibility: visibility || "PUBLIC",
      thumbnail: thumbnailUrl,
      instructions,
      projectType: projectType || "SINGLE",
      dueDate: dueDate ? new Date(dueDate) : null,
      youtuberId: req.user!.id,
      // Create permissions using nested create
      permissions: {
        create: {
          fullAccess: fullAccessBool,
          uploadAccess: uploadAccessBool,
          downloadAccess: downloadAccessBool,
          shareAccess: shareAccessBool,
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

    console.log("Project Details: ", project);
    return res
      .status(201)
      .json(
        new ApiResponse(200, project, "New project has been successully created")
      );
  })
});

// C2. Get project details by project display id
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

// C3. Get project ids
const getProjectIds = AsyncHandler(async (req: Request, res: Response) => { 

  if (!req.user) {
    throw new ApiError(401, "Unauthorized: User not authenticated.");
  }

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { youtuberId: req.user.id },   
        { editorId: req.user.id },      
      ],
    },
    select: {
      projectDisplayId: true,   
    },
  });

  const projectIds = projects.map((project) => project.projectDisplayId)
  return res
    .status(200)
    .json(new ApiResponse(200, projectIds, "Project Display IDs retrieved successfully"));
});

// C4. Edit an existing project
const editProject = AsyncHandler(async (req: Request, res: Response) => {
  
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      throw new ApiError(400, `Error occurred while uploading thumbnail: ${err.message}`);
    } else if (err) {
      throw new ApiError(400, err.message);
    }


    const { projectDisplayId } = req.params;

    let {
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
    
        let thumbnailUrl: string | undefined = undefined;
    if (req.file && req.file.mimetype.startsWith("image/")) {
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `thumbnail_${uuidv4()}${fileExtension}`;
      
      thumbnailUrl = await uploadToR2(
        req.file.buffer,
        fileName,
        req.file.mimetype,
        projectDisplayId,
      );

      // Optional: Delete old thumbnail from R2
      if (existingProject.thumbnail) {
        try {
          await deleteFromR2(existingProject.thumbnail);
        } catch (error) {
          console.warn("Failed to delete old thumbnail:", error);
        }
      }
    }

    let normalizedKeywords: string[] | undefined;
    if (keywords !== undefined) {
      if (Array.isArray(keywords)) {
        normalizedKeywords = keywords.map((k) => String(k).trim()).filter(Boolean);
      } else if (typeof keywords === "string") {
        normalizedKeywords = keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
      } else {
        normalizedKeywords = [];
      }
    }
  
    // visibility / projectType: normalize to uppercase enums if provided
    if (visibility !== undefined && typeof visibility === "string") {
      visibility = visibility.toUpperCase(); // "PUBLIC" | "UNLISTED" | "PRIVATE"
    }
  
    if (projectType !== undefined && typeof projectType === "string") {
      projectType = projectType.toUpperCase(); // "SINGLE" | "SERIES"
    }
  
    // permissions: normalize like createProject, but **do not apply defaults** when undefined
    // (undefined means "don't change")
    const fullAccessBool =
      fullAccess === undefined ? undefined : String(fullAccess) === "true" || fullAccess === true;
  
    const uploadAccessBool =
      uploadAccess === undefined ? undefined : String(uploadAccess) === "true" || uploadAccess === true;
  
    const downloadAccessBool =
      downloadAccess === undefined ? undefined : String(downloadAccess) === "true" || downloadAccess === true;
  
    const shareAccessBool =
      shareAccess === undefined ? undefined : String(shareAccess) === "true" || shareAccess === true;  
  
    try {
      // ✅ Use transaction to update both project and permissions atomically
      const result = await prisma.$transaction(async (tx) => {
        // Build project update data
        const updateData: any = {};
  
        if (title !== undefined) updateData.title = title;
        if (videoTitle !== undefined) updateData.videoTitle = videoTitle;
        if (description !== undefined) updateData.description = description;
        if (videoDescription !== undefined) updateData.videoDescription = videoDescription;
        if (normalizedKeywords !== undefined) updateData.keywords = normalizedKeywords;
        if (visibility !== undefined) updateData.visibility = visibility;
        if (thumbnailUrl !== undefined) updateData.thumbnail = thumbnailUrl; // New thumbnail
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
          const permissionUpdateData: any = {};
          
          if (fullAccessBool !== undefined) permissionUpdateData.fullAccess = fullAccessBool;
          if (uploadAccessBool !== undefined) permissionUpdateData.uploadAccess = uploadAccessBool;
          if (downloadAccessBool !== undefined) permissionUpdateData.downloadAccess = downloadAccessBool;
          if (shareAccessBool !== undefined) permissionUpdateData.shareAccess = shareAccessBool;
          
          await tx.projectPermission.update({
            where: { projectId: existingProject.id },
            data: permissionUpdateData,
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
  })
});

export { createProject, getProject, getProjectIds, editProject };
