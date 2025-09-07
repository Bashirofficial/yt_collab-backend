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
const sendMessage = AsyncHandler(async (req: Request, res: Response) => {});

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
