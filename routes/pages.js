import e from "express";
import path from "path";
import { configDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const router = e.Router();
configDotenv({ path: path.resolve(__dirname, "env/.env") });

router.get("/", (req, res) => {
  res.redirect("https://alexdevuwu.com");
});

router.get("/planToday", async (req, res) => {
  const key = req.query.key;
  if (key === process.env.KEY) {
    const options = { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" };
    const today = new Intl.DateTimeFormat("es-ES", options).format(new Date());
    try {
      const json = await fetch(`${process.env.URL}/eventDate?date=${today}`).then((res) => res.json());
      if (json.length === 0) {
        res.render("planToday", { plan: "inexistente!" });
      } else {
        console.log(json[0].description);
        res.render("planToday", { plan: json[0].description });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.redirect("https://alexdevuwu.com");
  }
});

export default router;
