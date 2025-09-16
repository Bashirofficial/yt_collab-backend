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

// C1. Send a message to project room
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
const getProjectMessages = AsyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const {
    page = 1,
    limit = 50,
    messageType,
    isRead,
    fromDate,
    toDate,
    senderId,
  } = req.query as any;
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }

  const project = await prisma.project.findFirst({
    where: {
      projectDisplayId: projectId,
      OR: [{ youtuberId: userId }, { editorId: userId }],
    },
  });

  if (!project) {
    throw new ApiError(400, "Project not found or access denied");
  }

  const whereClause: any = { projectId: project.id };

  if (messageType && typeof messageType === "string") {
    whereClause.messageType = messageType.toUpperCase()
  }

  if (isRead !== undefined) {
    whereClause.isRead = isRead === 'true'
  }

  if (senderId && typeof senderId === "string") {
    whereClause.senderId = senderId;
  }

  if (fromDate || toDate) {
    whereClause.createAt = {};
    if (fromDate) {
      whereClause.createAt.gte = new Date(fromDate a string)
    }
    if (toDate) {
      whereClause.createAt.lte = new Date(toDate as string)
    }
  }

  const skip = (Number(page) - 1) *  Number(limit);
  const take = Math.min(Number(limit), 100); //Max 100 messages per request

  try {
    const [messages, totalCount, unreadCount] = await Promise.all([
      prisma.message.findMany({
        where: whereClause,
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.message.count({ where: whereClause }),
      prisma.message.count({
        where: {
          ...whereClause,
          isRead: false,
          senderId: { not: userId } //Own message cant be unread.
        }
      })
    ])

    const totalPages = Math.ceil(totalCount / take);
    
    return res 
      .status(200)
      .json(new ApiResponse(200, {
        messages,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount, 
          unreadCount,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 
        }
      }, "Message retrieved successfully"))
  } catch (error) {
    console.error("Get messages error: ", error);
    throw new ApiError(500, "Failed to retireve messages")
  }
});

// C3. Mark message as read
const markMessagesAsRead = AsyncHandler(async (req: Request, res: Response) => {
    
  const { projectId } = req.params;
    const { messageIds } = req.body:
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "User not authenticated")
    }
    const project = await prisma.project.findFirst({
      where: {
        projectDisplayId: projectId,
        OR: [
          { youtuberId: userId },
          { editorId: userId }
        ]
      }
    })

    if (!project) {
      throw new ApiError(404, "Project not found or access denied")
    }
    
    try {
      const whereClause: any = {
        projectId: project.id,
        senderId: { not userId },
        isRead: false
      }

      if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
        whereClause.id = { in: messageIds }
      }

      const updatedMessages = await prisma.message.updateMany({
        where: whereClause,
        data: { isRead: true}
      })
      
      return res 
        .status(200)
        .json(new ApiResponse(200, {updatedCount: updatedMessages.count}, "Message marked as read"))
    } catch (error) {
      console.error("Mark as read error: ", error);
      throw new ApiError(500, "Failed to mark messages as read");
    }
  }
);

// C4. Get single message details
const getMessageById = AsyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }

  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      project: {
        OR: [
          { youtuberId: userId },
          { editorId: userId }
        ]
      }
    },
    include: {
      sender: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true
        }
      },
      project: {
        select: {
          id: true,
          title: true,
          projectDisplayId: true
        }
      }
    }
  })

  if (!message) {
    throw new ApiError(404, "Message not found or access denied")
  }

  return res
    .status(200)
    .json(new ApiResponse(200, message, "Message retrieved successfully"))
});

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
