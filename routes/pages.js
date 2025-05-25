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
        console.error("Usuario no encontrado en /nowPlaying");
        return res.status(404).render("error", { 
          error: "Usuario no encontrado. Por favor, autentícate con Spotify." 
        });
      }
      
      console.log("Cargando nowPlaying para usuario:", user.id);
      const nowPlaying = await getNowPlaying(user.accessToken);
      res.render("nowPlaying", { nowPlaying });
    } catch (error) {
      console.error("Error fetching now playing en página:", error);
      if (error.message === "INVALID_TOKEN") {
        return res.redirect("/auth/spotify");
      }
      res.status(500).render("error", { 
        error: "Error al obtener información de Spotify" 
      });
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
        console.error("Usuario no encontrado en /nowPlayingSong");
        return res.status(404).render("error", { 
          error: "Usuario no encontrado. Por favor, autentícate con Spotify." 
        });
      }
      
      console.log("Cargando nowPlayingSong para usuario:", user.id);
      const nowPlaying = await getNowPlaying(user.accessToken);
      res.render("nowPlayingSong", { nowPlaying });
    } catch (error) {
      console.error("Error fetching now playing song en página:", error);
      if (error.message === "INVALID_TOKEN") {
        return res.redirect("/auth/spotify");
      }
      res.status(500).render("error", { 
        error: "Error al obtener información de Spotify" 
      });
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
      console.log("No hay usuario de Twitch, redirigiendo a auth");
      return res.redirect("/auth/twitch");
    }

    if (Date.now() > user.expiresAt) {
      console.log("El token de Twitch ha expirado, refrescando...");
      try {
        user.accessToken = await refreshAccessToken(user, "twitch");
      } catch (error) {
        console.error("Error al refrescar el token de Twitch:", error);
        
        if (error.message === "INVALID_REFRESH_TOKEN") {
          console.log("Refresh token inválido, redirigiendo a reautenticación");
          return res.redirect("/auth/twitch");
        }
        
        return res.status(500).send("Error al refrescar el token de acceso.");
      }
    }

    res.render("alerts", { user, client_id: process.env.TWITCH_CLIENT_ID });
  } catch (error) {
    console.error("Error al acceder a alerts:", error);
    res.status(500).send("Error al acceder a alerts.");
  }
});

router.get("/collab/:direction/:channel", async (req, res) => {
  const { channel, direction } = req.params;
  try {
    const db = await readDB();
    const user = db.twitch;

    if (!user) {
      console.log("No hay usuario de Twitch para collab, redirigiendo a auth");
      return res.redirect("/auth/twitch");
    }

    if (Date.now() > user.expiresAt) {
      console.log("El token de Twitch ha expirado, refrescando...");
      try {
        user.accessToken = await refreshAccessToken(user, "twitch");
      } catch (error) {
        console.error("Error al refrescar el token de Twitch:", error);
        
        if (error.message === "INVALID_REFRESH_TOKEN") {
          console.log("Refresh token inválido, redirigiendo a reautenticación");
          return res.redirect("/auth/twitch");
        }
        
        return res.status(500).send("Error al refrescar el token de acceso.");
      }
    }

    const response = await fetch(`https://api.twitch.tv/helix/users?login=${channel}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error obteniendo usuario de Twitch:", response.status, errorText);
      
      if (response.status === 401) {
        return res.redirect("/auth/twitch");
      }
      
      throw new Error(`Twitch API error: ${response.status}`);
    }

    const data = await response.json();
    const { display_name, profile_image_url, login } = data.data[0];

    const streamResponse = await fetch(`https://api.twitch.tv/helix/streams?type=live&user_login=${channel}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID,
      },
    });

    if (!streamResponse.ok) {
      console.error("Error verificando stream de Twitch:", streamResponse.status);
    }

    const streamData = await streamResponse.json();
    const isLive = streamData.data.length > 0;

    res.render("collab", { direction, display_name, profile_image_url, login, isLive });
  } catch (error) {
    console.error("Error al acceder a colab:", error);
    res.status(500).send("Error al acceder a colab.");
  }
});

export default router;
