//! Import dependencies
import e from "express";
import path from "path";
import { configDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import session from "express-session";
import passport from "passport";

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
const PORT = process.env.PORT || 3000;
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
  })
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

//! Initialize the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
