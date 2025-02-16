import e from "express";
import passport from "passport";
import { Strategy as SpotifyStrategy } from "passport-spotify";
import { Strategy as TwitchStrategy } from "passport-twitch-new";
import path from "path";
import { configDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs/promises";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

configDotenv({ path: path.resolve(__dirname, "../env/.env") });

export const router = e.Router();

const dbFilePath = path.join(__dirname, "../data/db.json");

// Inicializar la base de datos con preset
async function initDB() {
  try {
    await fs.access(dbFilePath);
  } catch {
    await fs.writeFile(dbFilePath, JSON.stringify({ user: null }, null, 2));
  }
}
await initDB();

// Leer la base de datos
async function readDB() {
  const data = await fs.readFile(dbFilePath, "utf-8");
  return JSON.parse(data);
}

// Escribir en la base de datos
async function writeDB(data) {
  await fs.writeFile(dbFilePath, JSON.stringify(data, null, 2));
}

// Función para renovar el token de acceso
export async function refreshAccessToken(user, platform) {
  const url = platform === "spotify" ? "https://accounts.spotify.com/api/token" : "https://id.twitch.tv/oauth2/token";

  const params = {
    grant_type: "refresh_token",
    refresh_token: user.refreshToken,
    client_id: platform === "spotify" ? process.env.SPOTIFY_CLIENT_ID : process.env.TWITCH_CLIENT_ID,
    client_secret: platform === "spotify" ? process.env.SPOTIFY_CLIENT_SECRET : process.env.TWITCH_CLIENT_SECRET,
  };

  try {
    const response = await axios.post(url, null, {
      params,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const { access_token, refresh_token, expires_in } = response.data;
    user.accessToken = access_token;
    user.refreshToken = refresh_token || user.refreshToken;
    user.expiresAt = Date.now() + expires_in * 1000;
    await writeDB({ [platform]: user });
    return access_token;
  } catch (error) {
    console.error(`Error refreshing ${platform} access token:`, error);
    throw error;
  }
}

// Middleware para verificar y renovar el token si es necesario
export async function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    const db = await readDB();
    const user = db.user;
    if (user && Date.now() > user.expiresAt) {
      try {
        const newAccessToken = await refreshAccessToken(user, "spotify");
        req.user.accessToken = newAccessToken;
      } catch (error) {
        return res.redirect("/auth/spotify");
      }
    }
    return next();
  }
  res.redirect("/auth/spotify");
}

// Configurar la estrategia de Spotify
passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: `${process.env.APP_URL}/auth/spotify/callback`,
    },
    async function (accessToken, refreshToken, expires_in, profile, done) {
      const db = await readDB();
      db.user = { id: profile.id, accessToken, refreshToken, expiresAt: Date.now() + expires_in * 1000 };
      await writeDB(db);
      return done(null, { profile, accessToken, refreshToken });
    },
  ),
);

// Configurar la estrategia de Twitch
passport.use(
  new TwitchStrategy(
    {
      clientID: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
      callbackURL: `${process.env.APP_URL}/auth/twitch/callback`,
      scope: "user_read",
    },
    async function (accessToken, refreshToken, expires_in, profile, done) {
      const db = await readDB();
      const expiresAt = Date.now() + expires_in.expires_in * 1000;
      db.twitch = { id: profile.id, accessToken, refreshToken, expiresAt };
      await writeDB(db);
      return done(null, { profile, accessToken, refreshToken, expiresAt });
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

router.use(passport.initialize());
router.use(passport.session());

router.get(
  "/spotify",
  passport.authenticate("spotify", {
    scope: ["user-read-private", "user-read-email", "user-read-playback-state", "user-read-currently-playing"],
  }),
);

router.get("/spotify/callback", passport.authenticate("spotify", { failureRedirect: "/" }), (req, res) => {
  res.redirect("/nowPlayingSong");
});

router.get(
  "/twitch",
  passport.authenticate("twitch", {
    scope: ["user_read", "bits:read", "channel:read:subscriptions", "moderator:read:followers"],
  }),
);

router.get("/twitch/callback", passport.authenticate("twitch", { failureRedirect: "/" }), (req, res) => {
  res.redirect("/alerts");
});

export default router;
