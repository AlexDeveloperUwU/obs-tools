//! Import dependencies
import e from "express";
import path from "path";
import { configDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import session from "express-session";
import passport from "passport";
import { refreshAccessToken } from "./routes/auth.js";
import fs from "fs/promises";
import https from "https";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//! Load environment variables
const result = configDotenv({ path: path.resolve(__dirname, "env/.env") });
if (result.error) {
  console.error("Error loading .env file", result.error);
  process.exit(1);
}

//! App creation and configuration
const app = e();
app.use(e.static(path.join(__dirname, "public")));

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//! Session and Passport configuration
app.use(
  session({
    secret: process.env.KEY,
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(passport.initialize());
app.use(passport.session());

//! Routes
import pagesRouter from "./routes/pages.js";
import authRouter from "./routes/auth.js";
import apiRouter from "./routes/api.js";
app.use("/", pagesRouter);
app.use("/auth", authRouter);
app.use("/api", apiRouter);

//! Refresh tokens on startup
const dbFilePath = path.join(__dirname, "data/db.json");

async function refreshTokensOnStartup() {
  try {
    const data = await fs.readFile(dbFilePath, "utf-8");
    const db = JSON.parse(data);
    if (db.user) {
      await refreshAccessToken(db.user, "spotify");
    }
    if (db.twitch) {
      await refreshAccessToken(db.twitch, "twitch");
    }
  } catch (error) {
    console.error("Error refreshing tokens on startup:", error);
  }
}

await refreshTokensOnStartup();

//! Initialize the server
const PORT = process.env.PORT || 3000;
if (process.env.ENV === "production") {
  const options = {
    key: await fs.readFile(path.join(__dirname, "ssl/server.key")),
    cert: await fs.readFile(path.join(__dirname, "ssl/server.crt")),
  };
  https.createServer(options, app).listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
  });
} else {
  http.createServer(app).listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// TODO: Handle HTTPS in production for auth with Spotify and Twitch
// TODO: Handle HTTP in development for auth with Spotify and Twitch
