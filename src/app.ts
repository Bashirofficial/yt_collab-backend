import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import passport from "./controllers/googleAuth.controller";
import session from "express-session";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" })); //simply urlencoded() will also work
app.use(express.static("public"));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
  res.send("🚀 API is running");
});

import userRouter from "./routes/user.route";
import projectRouter from "./routes/project.route";
import googlAuthRouter from "./routes/googleAuth.route";
import fileRouter from "./routes/file.route";
import messageRouter from "./routes/message.route";

app.use("/api/v1/users", userRouter);
app.use("/api/v1/users", googlAuthRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/projects/:id/files", fileRouter);
app.use("/api/v1/users", messageRouter);
app.use(errorHandler);

export { app };
