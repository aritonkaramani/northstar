// api/sims-status.js
// GET /api/sims-status?difficulty=mythic|heroic
// Returns: { uploaders: [...], expected: ["noxfred", "farover", ...] }

import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getUploaders } from './_sims-kv.js';

const VALID_DIFFICULTIES = new Set(['mythic', 'heroic']);

function getExpectedPlayers() {
  try {
    const configPath = join(process.cwd(), 'roster.config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    // roster.config.json uses "mains" key (verified)
    const mains = config.mains ?? config.characters ?? [];
    return mains
      .filter(entry => entry && entry !== '---') // remove separators and empty strings
      .map(entry => {
        // Strip realm suffix: "Noxfred-TarrenMill" → "noxfred"
        const dashIdx = entry.indexOf('-');
        return (dashIdx === -1 ? entry : entry.slice(0, dashIdx)).toLowerCase();
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionCookie = parseCookie(req.headers.cookie || '').session;
    if (!sessionCookie) return res.status(401).json({ error: 'Not authenticated' });
    jwt.verify(sessionCookie, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const difficulty = req.query.difficulty?.toLowerCase();
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be "mythic" or "heroic"' });
  }

  const [uploaders, expected] = await Promise.all([
    getUploaders(difficulty),
    Promise.resolve(getExpectedPlayers()),
  ]);

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ uploaders, expected });
}
