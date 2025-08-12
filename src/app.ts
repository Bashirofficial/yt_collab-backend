import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import morgan from "morgan";
import { errorHandler } from "./middlewares/errorHandler.middleware";

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
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("🚀 API is running");
});

app.use(errorHandler);

export { app };
