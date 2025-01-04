import e from "express";
import path from "path";
import { configDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { ensureAuthenticated, refreshAccessToken } from "./auth.js";
import { readDB, getNowPlaying } from "./api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = e.Router();
configDotenv({ path: path.resolve(__dirname, "../env/.env") });

router.get("/planToday", async (req, res) => {
  const options = { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" };
  const today = new Intl.DateTimeFormat("es-ES", options).format(new Date());
  try {
    const json = await fetch(`${process.env.URL}/eventDate?date=${today}`).then((res) => res.json());
    if (json.length === 0) {
      res.render("planToday", { plan: "inexistente!" });
    } else {
      res.render("planToday", { plan: json[0].description });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/planTomorrow", async (req, res) => {
  const options = { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" };
  const tomorrow = new Intl.DateTimeFormat("es-ES", options).format(new Date(Date.now() + 86400000));
  try {
    const json = await fetch(`${process.env.URL}/eventDate?date=${tomorrow}`).then((res) => res.json());
    if (json.length === 0) {
      res.render("planTomorrow", { plan: "inexistente!" });
    } else {
      res.render("planTomorrow", { plan: json[0].description });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/nowPlaying", async (req, res) => {
  req.session.returnTo = "/nowPlaying";
  ensureAuthenticated(req, res, async () => {
    try {
      const db = await readDB();
      const user = db.user;
      if (!user) {
        return res.status(404).send("User not found");
      }
      const nowPlaying = await getNowPlaying(user.accessToken);
      res.render("nowPlaying", { nowPlaying });
    } catch (error) {
      console.error("Error fetching now playing:", error);
      res.status(500).send("Error fetching now playing");
    }
  });
});

router.get("/nowPlayingSong", async (req, res) => {
  req.session.returnTo = "/nowPlayingSong";
  ensureAuthenticated(req, res, async () => {
    try {
      const db = await readDB();
      const user = db.user;
      if (!user) {
        return res.status(404).send("User not found");
      }
      const nowPlaying = await getNowPlaying(user.accessToken);
      res.render("nowPlayingSong", { nowPlaying });
    } catch (error) {
      console.error("Error fetching now playing:", error);
      res.status(500).send("Error fetching now playing");
    }
  });
});

router.get("/chat", (req, res) => {
  res.render("chat");
});

router.get("/alerts", async (req, res) => {
  try {
    const db = await readDB();
    const user = db.twitch;

    if (!user) {
      return res.status(404).send("No hay datos en la base de datos de Twitch.");
    }

    // Verificar si el token ha expirado
    if (Date.now() > user.expiresAt) {
      console.log("El token ha expirado, refrescando...");
      try {
        user.accessToken = await refreshAccessToken(user, "twitch");
      } catch (error) {
        console.error("Error al refrescar el token de acceso:", error);
        return res.status(500).send("Error al refrescar el token de acceso.");
      }
    }

    res.render("alerts", { user, client_id: process.env.TWITCH_CLIENT_ID });
  } catch (error) {
    console.error("Error al acceder a alerts:", error);
    res.status(500).send("Error al acceder a alerts.");
  }
});

export default router;
