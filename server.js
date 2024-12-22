//! Import dependencies
import e from "express";
import path from "path";
import { configDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//! App creation and configuration
const app = e();
const PORT = process.env.PORT || 3000;
configDotenv({ path: path.resolve(__dirname, "env/.env") });
app.use(e.static(path.join(__dirname, "public")));

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//! Routes
import * as pages from "./routes/pages";
app.use("/", pages.router);

//! Initialize the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
