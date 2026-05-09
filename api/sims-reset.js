// api/sims-reset.js
// DELETE /api/sims-reset?difficulty=mythic|heroic
// GM-only: identified by ADMIN_BATTLETAG env var matching session battleTag

import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { resetDifficulty } from './sims-kv.js';

const VALID_DIFFICULTIES = new Set(['mythic', 'heroic']);

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    const sessionCookie = parseCookie(req.headers.cookie || '').session;
    if (!sessionCookie) return res.status(401).json({ error: 'Not authenticated' });
    user = jwt.verify(sessionCookie, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const adminBattletag = process.env.ADMIN_BATTLETAG;
  if (!adminBattletag || user.battleTag !== adminBattletag) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const difficulty = req.query.difficulty?.toLowerCase();
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be "mythic" or "heroic"' });
  }

  await resetDifficulty(difficulty);
  res.status(200).json({ ok: true, difficulty });
}
