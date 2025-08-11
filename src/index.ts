import express from "express";
import prisma from "./db";
import { errorHandler } from "./middlewares/errorHandler.middleware";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(errorHandler);

// Simple test route
app.get("/", async (req, res) => {
  try {
    // Test DB connection by running a simple query
    await prisma.$connect();
    res.send("✅ Database connected successfully!");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    res.status(500).send("Database connection failed");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
