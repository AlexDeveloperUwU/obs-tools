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
  console.log("Escribiendo en DB:", JSON.stringify(data, null, 2));
  await fs.writeFile(dbFilePath, JSON.stringify(data, null, 2));
}

// Función para renovar el token de acceso
export async function refreshAccessToken(user, platform) {
  if (!platform) {
    console.error("Platform no especificada en refreshAccessToken");
    throw new Error("Platform is required");
  }

  if (!user || !user.refreshToken) {
    console.error(`Usuario o refresh token no válido para ${platform}:`, { hasUser: !!user, hasRefreshToken: !!user?.refreshToken });
    throw new Error("Invalid user or refresh token");
  }

  const url = platform === "spotify" ? "https://accounts.spotify.com/api/token" : "https://id.twitch.tv/oauth2/token";

  const params = {
    grant_type: "refresh_token",
    refresh_token: user.refreshToken,
    client_id: platform === "spotify" ? process.env.SPOTIFY_CLIENT_ID : process.env.TWITCH_CLIENT_ID,
    client_secret: platform === "spotify" ? process.env.SPOTIFY_CLIENT_SECRET : process.env.TWITCH_CLIENT_SECRET,
  };

  try {
    console.log(`Renovando token de ${platform} para usuario:`, user.id);
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
    
    // Actualizar la base de datos completa
    const db = await readDB();
    if (platform === "spotify") {
      db.user = user;
    } else {
      db[platform] = user;
    }
    await writeDB(db);
    
    console.log(`Token de ${platform} renovado exitosamente`);
    return access_token;
  } catch (error) {
    console.error(`Error refreshing ${platform} access token:`, error.response?.data || error.message);
    
    // Manejo específico de errores
    if (error.response?.status === 400) {
      const errorData = error.response.data;
      if (errorData.message === "Invalid refresh token" || errorData.error === "invalid_grant") {
        console.log(`Refresh token inválido para ${platform}, requiere reautenticación`);
        
        // Limpiar tokens inválidos de la base de datos
        const db = await readDB();
        if (platform === "spotify") {
          db.user = null;
        } else {
          delete db[platform];
        }
        await writeDB(db);
        
        throw new Error("INVALID_REFRESH_TOKEN");
      }
    }
    
    throw error;
  }
}

// Middleware para verificar y renovar el token si es necesario
export async function ensureAuthenticated(req, res, next) {
  try {
    if (req.isAuthenticated()) {
      const db = await readDB();
      const user = db.user;
      
      if (!user) {
        console.log("Usuario no encontrado en sesión, redirigiendo a auth");
        return res.redirect("/auth/spotify");
      }
      
      if (user && Date.now() > user.expiresAt) {
        try {
          console.log("Token expirado, renovando en middleware");
          const newAccessToken = await refreshAccessToken(user, "spotify");
          req.user.accessToken = newAccessToken;
        } catch (error) {
          console.error("Error renovando token en middleware:", error);
          return res.redirect("/auth/spotify");
        }
      }
      return next();
    }
    console.log("Usuario no autenticado, redirigiendo a auth");
    res.redirect("/auth/spotify");
  } catch (error) {
    console.error("Error en ensureAuthenticated:", error);
    res.redirect("/auth/spotify");
  }
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
      try {
        console.log("Autenticando usuario de Spotify:", profile.id);
        const db = await readDB();
        db.user = { 
          id: profile.id, 
          accessToken, 
          refreshToken, 
          expiresAt: Date.now() + expires_in * 1000,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value
        };
        await writeDB(db);
        console.log("Usuario de Spotify guardado en DB");
        return done(null, { profile, accessToken, refreshToken });
      } catch (error) {
        console.error("Error guardando usuario de Spotify:", error);
        return done(error, null);
      }
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
