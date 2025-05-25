import e from "express";
import path from "path";
import { configDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs/promises";
import axios from "axios";
import { refreshAccessToken } from "./auth.js"; // Importar la función de renovación de token

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

configDotenv({ path: path.resolve(__dirname, "../env/.env") });

export const router = e.Router();

const dbFilePath = path.join(__dirname, "../data/db.json");

// Leer la base de datos
export async function readDB() {
  const data = await fs.readFile(dbFilePath, "utf-8");
  return JSON.parse(data);
}

// Obtener el estado de "Now Playing"
export async function getNowPlaying(accessToken) {
  try {
    const response = await axios.get("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log("Token de Spotify expirado o inválido");
      throw new Error("INVALID_TOKEN");
    } else if (error.response?.status === 204) {
      console.log("No hay contenido reproduciéndose");
      return { is_playing: false };
    }
    console.error("Error fetching now playing:", error.response?.data || error.message);
    throw error;
  }
}

router.get("/nowPlaying", async (req, res) => {
  try {
    const db = await readDB();
    console.log("DB contenido:", JSON.stringify(db, null, 2));
    
    // Buscar usuario en diferentes ubicaciones por compatibilidad
    let user = db.user || db.spotify;
    
    if (!user) {
      console.error("No se encontró usuario en la base de datos. DB estructura:", Object.keys(db));
      return res.status(404).json({ 
        error: "User not found", 
        message: "No hay usuario autenticado con Spotify",
        dbKeys: Object.keys(db),
        requiresAuth: true
      });
    }

    console.log("Usuario encontrado:", { id: user.id, hasToken: !!user.accessToken, expiresAt: user.expiresAt });

    // Verificar si el token ha expirado y renovarlo si es necesario
    if (Date.now() > user.expiresAt) {
      console.log("Token expirado, renovando...");
      try {
        user.accessToken = await refreshAccessToken(user, "spotify");
        console.log("Token renovado exitosamente");
      } catch (error) {
        console.error("Error renovando token:", error);
        
        if (error.message === "INVALID_REFRESH_TOKEN") {
          return res.status(401).json({ 
            error: "Invalid refresh token", 
            message: "Refresh token inválido. Reautenticación requerida.",
            requiresAuth: true
          });
        }
        
        return res.status(401).json({ 
          error: "Token refresh failed", 
          message: "No se pudo renovar el token de acceso. Reautenticación requerida.",
          requiresAuth: true
        });
      }
    }

    const nowPlaying = await getNowPlaying(user.accessToken);

    // Verificar si se está reproduciendo algo
    if (!nowPlaying || !nowPlaying.item) {
      return res.json({ is_playing: false });
    }

    res.json(nowPlaying);
  } catch (error) {
    console.error("Error en /nowPlaying:", error);
    
    if (error.message === "INVALID_TOKEN") {
      return res.status(401).json({ 
        error: "Invalid token", 
        message: "Token de Spotify inválido. Reautenticación requerida.",
        requiresAuth: true
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error", 
      message: "Error interno del servidor al obtener información de Spotify" 
    });
  }
});

router.get("/isLive/:channel", async (req, res) => {
  const { channel } = req.params;
  try {
    const db = await readDB();
    const user = db.twitch;

    if (!user) {
      return res.status(404).json({
        error: "Twitch user not found",
        message: "No hay datos en la base de datos de Twitch.",
        requiresAuth: true
      });
    }

    if (Date.now() > user.expiresAt) {
      console.log("El token de Twitch ha expirado, refrescando...");
      try {
        user.accessToken = await refreshAccessToken(user, "twitch");
        console.log("Token de Twitch renovado exitosamente");
      } catch (error) {
        console.error("Error al refrescar el token de Twitch:", error);
        
        if (error.message === "INVALID_REFRESH_TOKEN") {
          return res.status(401).json({
            error: "Invalid Twitch refresh token",
            message: "Refresh token de Twitch inválido. Reautenticación requerida.",
            requiresAuth: true
          });
        }
        
        return res.status(500).json({
          error: "Token refresh failed",
          message: "Error al refrescar el token de Twitch."
        });
      }
    }

    const streamResponse = await fetch(`https://api.twitch.tv/helix/streams?user_login=${channel}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID,
      },
    });

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text();
      console.error("Error en API de Twitch:", streamResponse.status, errorText);
      
      if (streamResponse.status === 401) {
        return res.status(401).json({
          error: "Twitch API unauthorized",
          message: "Token de Twitch inválido.",
          requiresAuth: true
        });
      }
      
      throw new Error(`Twitch API error: ${streamResponse.status}`);
    }

    const streamData = await streamResponse.json();
    const isLive = streamData.data.length > 0;

    res.json({ isLive });
  } catch (error) {
    console.error("Error al verificar si está en directo:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Error al verificar si está en directo."
    });
  }
});

export default router;
