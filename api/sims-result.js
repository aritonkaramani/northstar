// api/sims-result.js
// GET  /api/sims-result?difficulty=mythic|heroic  — fetch sim results
// DELETE /api/sims-result?difficulty=mythic|heroic — GM-only reset

import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';
import { resetDifficulty } from './_sims-kv.js';

const VALID_DIFFICULTIES = new Set(['mythic', 'heroic']);

function getSession(req) {
  try {
    const sessionCookie = parseCookie(req.headers.cookie || '').session;
    if (!sessionCookie) return null;
    return jwt.verify(sessionCookie, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const user = getSession(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const difficulty = req.query.difficulty?.toLowerCase();
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be "mythic" or "heroic"' });
  }

  if (req.method === 'GET') {
    try {
      const result = await kv.get(`sims:${difficulty}:result`);
      if (!result) return res.status(200).json({ items: [], players: [], matrix: [] });
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(result);
    } catch {
      res.status(200).json({ items: [], players: [], matrix: [] });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const adminBattletag = process.env.ADMIN_BATTLETAG;
    if (!adminBattletag || user.battleTag !== adminBattletag) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await resetDifficulty(difficulty);
    return res.status(200).json({ ok: true, difficulty });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
