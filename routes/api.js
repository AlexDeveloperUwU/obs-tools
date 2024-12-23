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
    console.error("Error fetching now playing:", error);
    throw error;
  }
}

router.get("/nowPlaying", async (req, res) => {
  try {
    const db = await readDB();
    const user = db.user;
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Verificar si el token ha expirado y renovarlo si es necesario
    if (Date.now() > user.expiresAt) {
      try {
        user.accessToken = await refreshAccessToken(user);
      } catch (error) {
        return res.status(500).send("Error refreshing access token");
      }
    }

    const nowPlaying = await getNowPlaying(user.accessToken);

    // Verificar si se está reproduciendo algo
    if (!nowPlaying || !nowPlaying.item) {
      return res.json({ is_playing: false });
    }

    res.json(nowPlaying);
  } catch (error) {
    res.status(500).send("Error fetching now playing");
  }
});

export default router;
