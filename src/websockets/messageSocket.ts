import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import prisma from "../db";
import { error } from "console";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
  projectRooms?: Set<string>;
}

interface SocketUser {
  id: string;
  name: string;
  email: string;
  socketId: string;
}

// Storing connected  users by project
const projectUsers = new Map<string, Map<string, SocketUser>>();

// Initialize WebSocket server
export const initializeMessageSocket = (httpServer: HTTPServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Invalid token"));
      }

      console.log("Debugging Message socket token: ", token);

      const decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET!
      ) as any;
      const userId = decoded.id || decoded.userId;
      console.log("decode: ", decoded);
      console.log("userId: ", decoded.id);
      console.log("userId: ", decoded.userId);

      if (!userId) {
        return next(new Error("Invalid token"));
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.userId = userId;
      socket.user = user;
      socket.projectRooms = new Set();

      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.userId} connected to messaging`);

    // Join project room
    socket.on("join-project", async (data: { projectId: string }) => {
      try {
        const { projectId } = data;

        const project = await prisma.project.findFirst({
          where: {
            projectDisplayId: projectId,
            OR: [{ youtuberId: socket.userId }, { editorId: socket.userId }],
          },
        });

        if (!project) {
          socket.emit("error", { message: "Access denied to project" });
          return;
        }

        const roomName = `project:${project.id}`;
        socket.join(roomName);
        socket.projectRooms?.add(roomName);

        // Add user to project users map
        if (!projectUsers.has(project.id)) {
          projectUsers.set(project.id, new Map());
        }

        const projectUserMap = projectUsers.get(projectId)!;
        projectUserMap.set(socket.userId!, {
          id: socket.userId!,
          name: socket.user.name,
          email: socket.user.email,
          socketId: socket.id,
        });

        // Notify other users in project
        socket.to(roomName).emit("user-joined", {
          user: {
            id: socket.userId!,
            name: socket.user!.name,
            email: socket.user!.email,
          },
          timeStamp: new Date(),
        });

        // Send current online users to joining user
        const onlineUsers = Array.from(projectUserMap.values()).filter(
          (u) => u.id !== socket.userId
        );
        socket.emit("online-users", { users: onlineUsers });
        socket.emit("joined-project", { projectId: project.projectDisplayId });
      } catch (error) {
        console.error("Join project error: ", error);
        socket.emit("error", { message: "Failed to join project" });
      }
    });

    // Leave project room
    socket.on("leave-project", async (data: { projectId: string }) => {
      try {
        const { projectId } = data;

        const project = await prisma.project.findFirst({
          where: {
            projectDisplayId: projectId,
            OR: [{ youtuberId: socket.userId }, { editorId: socket.userId }],
          },
        });

        const roomName = `project:${project.id}`;

        socket.leave(roomName);
        socket.projectRooms?.delete(roomName);

        // Remove user from project users map
        const projectUserMap = projectUsers.get(project.id);

        if (projectUserMap) {
          projectUserMap.delete(socket.userId!);

          // Notify other user
          socket.to(roomName).emit("user-left", {
            user: {
              id: socket.userId,
              name: socket.user!.name,
            },
            timestamp: new Date(),
          });
        }

        socket.emit("left-project", { projectId: project?.projectDisplayId });
      } catch (error) {
        console.error("Leave project error occured: ", error);
      }
    });

    // Send message
    socket.on(
      "send-message",
      async (data: {
        projectId: string;
        content: string;
        messageType?: "TEXT" | "FILE" | "SYSTEM" | "NOTIFICATION";
        fileUrl?: string;
        fileName?: string;
      }) => {
        try {
          const {
            projectId,
            content,
            messageType = "TEXT",
            fileUrl,
            fileName,
          } = data;

          // Verify project access
          const project = await prisma.project.findFirst({
            where: {
              projectDisplayId: projectId,
              OR: [{ youtuberId: socket.userId }, { editorId: socket.userId }],
            },
          });

          if (!project) {
            socket.emit("error", { message: "Access denied to project" });
            return;
          }

          // Create message in database
          const message = await prisma.message.create({
            data: {
              projectId: project.id,
              senderId: socket.userId!,
              content: content.trim(),
              messageType,
              metadata: messageType === "FILE" ? { fileUrl, fileName } : {},
            },
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
            },
          });

          const roomName = `project:${project.id}`;

          // Broadcast to all users in project
          io.to(roomName).emit("new-message", {
            message: message,
            timestamp: new Date(),
          });

          socket.emit("message-sent", { messageId: message.id });
        } catch (error) {
          console.error("Send message error:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
    });
    
    // Typing indicators
    socket.on("typing-start", async(data: { projectId: string }) => {
      const {projectId} = data;
      const roomName = `project:${project.id}` const roomName = `project:${projectId}`;
      if (!socket.projectRooms?.has(roomName)) return; 

      socket.to(roomName).emit('user-typing', {
        user: {
          id: socket.userId!,
          name: socket.user!.name
        },
        isTyping: true
      })
    })

    //
    socket.on("typing-stop", async(data: { projectId: string }) => {
      const {projectId} = data;
      const roomName = `project:${project.id}` const roomName = `project:${projectId}`;
      if (!socket.projectRooms?.has(roomName)) return; 

      socket.to(roomName).emit('user-typing', {
        user: {
          id: socket.userId!,
          name: socket.user!.name
        },
        isTyping: false
      })
    })

    // Mark message as seen
    socket.on("mark-as-read", async(data: { projectId: string; messageIds?: string[] }) => {
      try {
        const { projectId,  messageIds} = data;
      const project = await prisma.project.findFirst({
        where: {
          projectDisplayId: projectId
        }
      })

      if (!project) return;
      
      const whereClause: any = {
        projectId: project.id,
        senderId: { not: socket.userId },
        isRead: false
      };

      if (messageIds && messageIds.length > 0) {
        whereClause.id = { in: messageIds}
      }

      await prisma.message.updateMany({
        where: whereClause,
        data: { isRead: true }
      })

      socket.to(`project:${project.id}`).emit('messages-read', {
        readBy: {
          id: socket.userId!,
          name: socket.user!.name
        },
        messageIds: messageIds || 'all',
        timestamp: new Date()
      } catch (error) {
        console.error("Mark as read error: ", error)
      }  
    })

    // Handle disconnection 
    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected from messaging`)

      if (socket.projectRooms) {
        socket.projectRooms.forEach(roomName => {
          const projectId = roomName.replace('project:', '');
          const projectUserMap = projectUsers.get(projectId)

          if(projectUserMap) {
            projectUserMap.delete(socket.userId!)
            
            socket.to(roomName).emit('user-left', {
              user: {
                id: socket.userId,
                name: socket.user?.name
              },
              timestamp: new Data()
            })
          }
        })
      }
    })

    // Handle errors
    socket.on('error',(error) => {
      console.error('Socket error:', error)
    })
  });

  return io;
};

// Helper function to send system messages

