import dotenv from "dotenv";
dotenv.config({ path: ".env.test.local" });

// Suppress console logs during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Only suppress logs in test environment, not in CI
  if (!process.env.CI && process.env.NODE_ENV === "test") {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test timeout
jest.setTimeout(15000);
