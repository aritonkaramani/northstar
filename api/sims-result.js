// api/sims-result.js
// GET /api/sims-result?difficulty=mythic|heroic

import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';

const VALID_DIFFICULTIES = new Set(['mythic', 'heroic']);

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

  try {
    const result = await kv.get(`sims:${difficulty}:result`);
    if (!result) {
      return res.status(200).json({ items: [], players: [], matrix: [] });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(result);
  } catch {
    // KV not configured yet — return empty result so the page loads
    res.status(200).json({ items: [], players: [], matrix: [] });
  }
}
