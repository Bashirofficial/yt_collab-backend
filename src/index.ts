import { connectDB } from "./db";
import { app } from "./app";

import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
})();
