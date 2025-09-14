// tests/sockets/unit.test.ts - Simplified version without typing issues
import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import { initializeMessageSocket } from "../../src/websockets/messageSocket";
import {
  mockPrisma,
  mockTestData,
  createMockSocketData,
  resetAllMocks,
  setupSuccessfulMocks,
  setupAuthFailureMocks,
  setupProjectNotFoundMocks,
} from "./mocks";

// Mock the database
jest.mock("../../src/db", () => require("./mocks").mockPrisma);

// Mock jwt completely
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
  sign: jest.fn(),
  decode: jest.fn(),
}));

// Import after mocking
const jwt = require("jsonwebtoken");

describe("Message Socket Service", () => {
  let httpServer: HTTPServer;
  let io: SocketIOServer;
  let clientSocket: ClientSocket;
  let secondClientSocket: ClientSocket;

  const TEST_PORT = 3001;
  const CONNECTION_TIMEOUT = 3000;

  beforeAll((done) => {
    httpServer = new HTTPServer();
    io = initializeMessageSocket(httpServer);
    httpServer.listen(TEST_PORT, done);
  });

  afterAll((done) => {
    if (clientSocket?.connected) clientSocket.disconnect();
    if (secondClientSocket?.connected) secondClientSocket.disconnect();
    io?.close();
    httpServer?.close(done);
  });

  beforeEach(() => {
    resetAllMocks();
    setupSuccessfulMocks();

    // Setup JWT mock to return valid payload
    jwt.verify.mockReturnValue({
      id: mockTestData.user.id,
      email: mockTestData.user.email,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
  });

  afterEach(() => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
      clientSocket = null as any;
    }
    if (secondClientSocket?.connected) {
      secondClientSocket.disconnect();
      secondClientSocket = null as any;
    }
    jest.clearAllMocks();
  });

  // Helper function to create socket connection
  const createSocketConnection = (
    token: string = createMockSocketData.validToken
  ): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const client = Client(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        forceNew: true,
      });

      const timeout = setTimeout(() => {
        client.disconnect();
        reject(new Error("Connection timeout"));
      }, CONNECTION_TIMEOUT);

      client.on("connect", () => {
        clearTimeout(timeout);
        resolve(client);
      });

      client.on("connect_error", (error) => {
        clearTimeout(timeout);
        client.disconnect();
        reject(error);
      });
    });
  };

  // Helper to join project
  const joinProject = (
    socket: ClientSocket,
    projectId: string = mockTestData.project.projectDisplayId
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Join project timeout"));
      }, CONNECTION_TIMEOUT);

      socket.on("joined-project", () => {
        clearTimeout(timeout);
        resolve();
      });

      socket.on("error", (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });

      socket.emit("join-project", { projectId });
    });
  };

  describe("Authentication", () => {
    test("should accept valid token and authenticate user", async () => {
      clientSocket = await createSocketConnection();
      expect(clientSocket.connected).toBe(true);
      expect(jwt.verify).toHaveBeenCalledWith(
        createMockSocketData.validToken,
        process.env.ACCESS_TOKEN_SECRET
      );
    });

    test("should reject connection with invalid token", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(
        createSocketConnection(createMockSocketData.invalidToken)
      ).rejects.toThrow();
    });

    test("should reject connection when user not found", async () => {
      setupAuthFailureMocks();

      await expect(createSocketConnection()).rejects.toThrow();
    });
  });

  describe("Join Project", () => {
    beforeEach(async () => {
      clientSocket = await createSocketConnection();
    });

    test("should join project successfully", async () => {
      await expect(joinProject(clientSocket)).resolves.not.toThrow();

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          projectDisplayId: mockTestData.project.projectDisplayId,
          OR: [
            { youtuberId: mockTestData.user.id },
            { editorId: mockTestData.user.id },
          ],
        },
      });
    });

    test("should emit error if project not found", (done) => {
      setupProjectNotFoundMocks();

      clientSocket.on("error", (data) => {
        expect(data.message).toBe("Access denied to project");
        done();
      });

      clientSocket.emit("join-project", { projectId: "non-existent" });
    });

    test("should emit online users list", (done) => {
      clientSocket.on("online-users", (data) => {
        expect(Array.isArray(data.users)).toBe(true);
        done();
      });

      clientSocket.emit("join-project", createMockSocketData.joinProjectData);
    });
  });

  describe("Leave Project", () => {
    beforeEach(async () => {
      clientSocket = await createSocketConnection();
      await joinProject(clientSocket);
    });

    test("should leave project successfully", (done) => {
      clientSocket.on("left-project", (data) => {
        expect(data.projectId).toBe(mockTestData.project.projectDisplayId);
        done();
      });

      clientSocket.emit("leave-project", createMockSocketData.joinProjectData);
    });
  });

  describe("Messaging", () => {
    beforeEach(async () => {
      clientSocket = await createSocketConnection();
      await joinProject(clientSocket);
    });

    test("should send message and emit new-message", (done) => {
      const messageWithSender = {
        ...mockTestData.message,
        sender: mockTestData.user,
      };
      mockPrisma.message.create.mockResolvedValue(messageWithSender);

      let eventCount = 0;
      const checkCompletion = () => {
        eventCount++;
        if (eventCount === 2) done(); // Wait for both events
      };

      clientSocket.on("new-message", (data) => {
        expect(data.message.content).toBe("Test message");
        expect(data.message.sender.id).toBe(mockTestData.user.id);
        checkCompletion();
      });

      clientSocket.on("message-sent", (data) => {
        expect(data.messageId).toBe(mockTestData.message.id);
        checkCompletion();
      });

      clientSocket.emit("send-message", createMockSocketData.sendMessageData);
    });

    test("should handle file messages", (done) => {
      const fileMessage = {
        ...mockTestData.fileMessage,
        sender: mockTestData.user,
      };
      mockPrisma.message.create.mockResolvedValue(fileMessage);

      clientSocket.on("new-message", (data) => {
        expect(data.message.messageType).toBe("FILE");
        expect(data.message.metadata.fileUrl).toBe(
          "https://example.com/file.pdf"
        );
        done();
      });

      clientSocket.emit(
        "send-message",
        createMockSocketData.sendFileMessageData
      );
    });
  });

  describe("Typing Indicators", () => {
    beforeEach(async () => {
      clientSocket = await createSocketConnection();
      await joinProject(clientSocket);
    });

    test("should emit user-typing true", async () => {
      secondClientSocket = await createSocketConnection();
      await joinProject(secondClientSocket);

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Typing indicator timeout"));
        }, CONNECTION_TIMEOUT);

        secondClientSocket.on("user-typing", (data) => {
          clearTimeout(timeout);
          expect(data.user.id).toBe(mockTestData.user.id);
          expect(data.isTyping).toBe(true);
          resolve();
        });

        setTimeout(() => {
          clientSocket.emit("typing-start", createMockSocketData.typingData);
        }, 100);
      });
    });
  });

  describe("Read Receipts", () => {
    beforeEach(async () => {
      clientSocket = await createSocketConnection();
      await joinProject(clientSocket);
    });

    test("should mark messages as read", async () => {
      secondClientSocket = await createSocketConnection();
      await joinProject(secondClientSocket);

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Read receipt timeout"));
        }, CONNECTION_TIMEOUT);

        secondClientSocket.on("messages-read", (data) => {
          clearTimeout(timeout);
          expect(data.readBy.id).toBe(mockTestData.user.id);
          expect(data.messageIds).toEqual(
            createMockSocketData.markAsReadData.messageIds
          );
          resolve();
        });

        setTimeout(() => {
          clientSocket.emit(
            "mark-as-read",
            createMockSocketData.markAsReadData
          );
        }, 100);
      });
    });
  });

  describe("Disconnect Handling", () => {
    test("should clean up user on disconnect", async () => {
      clientSocket = await createSocketConnection();
      await joinProject(clientSocket);

      secondClientSocket = await createSocketConnection();
      await joinProject(secondClientSocket);

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Disconnect cleanup timeout"));
        }, CONNECTION_TIMEOUT);

        secondClientSocket.on("user-left", (data) => {
          clearTimeout(timeout);
          expect(data.user.id).toBe(mockTestData.user.id);
          resolve();
        });

        setTimeout(() => {
          clientSocket.disconnect();
        }, 100);
      });
    });
  });
});
