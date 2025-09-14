import { Request, Response } from "express";
import prisma from "../db";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { AsyncHandler } from "../utils/AsyncHandler";

// Types defined for message controllers
interface CreateMessageRequest {
  content: string;
  messageType?: "TEXT" | "FILE" | "SYSTEM" | "NOTIFICATION";
  fileUrl?: string;
  fileName?: string;
}

interface MessageFilters {
  messageType?: string;
  isRead?: boolean;
  fromDate?: string;
  toDate?: string;
  senderId?: string;
}

//--------- Controllers (C) ---------//

// C1. Send a message to a project
const sendMessage = AsyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const {
    content,
    messageType = "TEXT",
    fileUrl,
    fileName,
  }: CreateMessageRequest = req.body;
  const senderId = req.user?.id;

  if (!senderId) {
    throw new ApiError(401, "User not authenticated");
  }

  if (!content && !fileUrl) {
    throw new ApiError(400, "Message content is required");
  }

  if (content.length > 2000) {
    throw new ApiError(400, "Message cannot exceed 2000 characters");
  }

  const project = await prisma.project.findFirst({
    where: {
      projectDisplayId: projectId,
      OR: [{ youtuberId: senderId }, { editorId: senderId }],
    },
  });

  if (!project) {
    throw new ApiError(404, "Project not found or access denied");
  }

  if (messageType === "FILE") {
    if (!fileUrl)
      throw new ApiError(400, "File URL is required for file messages");
    if (!fileName)
      throw new ApiError(400, "File name is required for file messages");
  }

  try {
    const message = await prisma.message.create({
      data: {
        projectId: project.id,
        senderId,
        content: content.trim() || "",
        messageType,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            projectDisplayId: true,
          },
        },
      },
    });

    // System message for file uploads
    if (messageType === "FILE") {
      await prisma.message.create({
        data: {
          projectId,
          senderId,
          content: content || "",
          messageType: "FILE",
          metadata: { fileUrl, fileName },
        },
      });
    }

    return res
      .status(201)
      .json(new ApiResponse(201, message, "Message sent successfully"));
  } catch (error) {
    console.error("Send message error: ", error);
    throw new ApiError(500, "Failed to send message");
  }
});

// C2. Get messages for a project with pagination and filters
const getProjectMessages = AsyncHandler(
  async (req: Request, res: Response) => {}
);

// C3. Get single message details
const markMessagesAsRead = AsyncHandler(
  async (req: Request, res: Response) => {}
);

// C4. Send a message to a project
const getMessageById = AsyncHandler(async (req: Request, res: Response) => {});

// C5. Delete message (soft delete by setting content to "[deleted]")
const deleteMessage = AsyncHandler(async (req: Request, res: Response) => {});

// C6. Get message statistics for a project
const getMessageStats = AsyncHandler(async (req: Request, res: Response) => {});

// C7. Search messages in a project
const searchMessages = AsyncHandler(async (req: Request, res: Response) => {});

export {
  sendMessage,
  getProjectMessages,
  markMessagesAsRead,
  getMessageById,
  deleteMessage,
  getMessageStats,
  searchMessages,
};
