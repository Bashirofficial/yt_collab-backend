// tests/sockets/mocks.ts - Updated with better type handling
import type { JwtPayload } from "jsonwebtoken";

export const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  $disconnect: jest.fn(),
  $connect: jest.fn(),
};

// Custom JWT payload interface that matches your socket implementation
export interface MockJwtPayload extends JwtPayload {
  id: string;
  userId?: string;
  email: string;
  exp: number;
  iat?: number;
}

// Mock data for tests
export const mockTestData = {
  user: {
    id: "user123",
    name: "Test User",
    email: "test@example.com",
    avatar: "https://example.com/avatar.jpg",
  },

  project: {
    id: "project123",
    projectDisplayId: "proj_display_123",
    youtuberId: "user123",
    editorId: null,
    title: "Test Project",
    description: "Test project description",
  },

  message: {
    id: "msg123",
    projectId: "project123",
    senderId: "user123",
    content: "Test message",
    messageType: "TEXT" as const,
    metadata: {},
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  fileMessage: {
    id: "msg124",
    projectId: "project123",
    senderId: "user123",
    content: "File shared",
    messageType: "FILE" as const,
    metadata: {
      fileUrl: "https://example.com/file.pdf",
      fileName: "document.pdf",
      fileSize: "1.2MB",
      mimeType: "application/pdf",
    },
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Socket test helpers
export const createMockSocketData = {
  validToken: "valid-jwt-token",
  invalidToken: "invalid-jwt-token",

  // JWT decode responses with proper typing
  validJwtPayload: {
    id: mockTestData.user.id,
    userId: mockTestData.user.id, // Include both for compatibility
    email: mockTestData.user.email,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
  } as MockJwtPayload,

  invalidJwtPayload: {
    id: "invalid-user",
    email: "invalid@example.com",
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired token
  } as MockJwtPayload,

  // Common socket events data
  joinProjectData: {
    projectId: mockTestData.project.projectDisplayId,
  },

  sendMessageData: {
    projectId: mockTestData.project.projectDisplayId,
    content: "Test message",
    messageType: "TEXT" as const,
  },

  sendFileMessageData: {
    projectId: mockTestData.project.projectDisplayId,
    content: "File shared",
    messageType: "FILE" as const,
    fileUrl: "https://example.com/file.pdf",
    fileName: "document.pdf",
  },

  typingData: {
    projectId: mockTestData.project.projectDisplayId,
  },

  markAsReadData: {
    projectId: mockTestData.project.projectDisplayId,
    messageIds: ["msg1", "msg2", "msg3"],
  },
};

// Reset all mocks helper
export const resetAllMocks = () => {
  Object.values(mockPrisma.user).forEach((mock) => mock.mockReset());
  Object.values(mockPrisma.project).forEach((mock) => mock.mockReset());
  Object.values(mockPrisma.message).forEach((mock) => mock.mockReset());
  mockPrisma.$disconnect.mockReset();
  mockPrisma.$connect.mockReset();
};

// Common mock setups
export const setupSuccessfulMocks = () => {
  mockPrisma.user.findUnique.mockResolvedValue(mockTestData.user);
  mockPrisma.project.findFirst.mockResolvedValue(mockTestData.project);
  mockPrisma.message.create.mockResolvedValue({
    ...mockTestData.message,
    sender: mockTestData.user,
  });
  mockPrisma.message.updateMany.mockResolvedValue({ count: 1 });
};

export const setupAuthFailureMocks = () => {
  mockPrisma.user.findUnique.mockResolvedValue(null);
};

export const setupProjectNotFoundMocks = () => {
  mockPrisma.user.findUnique.mockResolvedValue(mockTestData.user);
  mockPrisma.project.findFirst.mockResolvedValue(null);
};

// JWT Mock helpers
export const createJwtMockImplementations = () => ({
  validToken: () => createMockSocketData.validJwtPayload,
  invalidToken: () => {
    throw new Error("Invalid token");
  },
  expiredToken: () => {
    throw new Error("Token expired");
  },
  malformedToken: () => {
    throw new Error("Malformed token");
  },
});
