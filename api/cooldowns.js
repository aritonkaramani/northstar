// api/cooldowns.js
// GET  /api/cooldowns          — returns encounter index array
// GET  /api/cooldowns?id=<n>   — returns { raw, savedAt } for that encounter or 404
// POST /api/cooldowns          — saves { raw } body, keyed by parsed EncounterID

import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { getEncounterIndex, getCooldowns, setCooldowns } from './_cooldowns-kv.js';

function getSession(req) {
  try {
    const sessionCookie = parseCookie(req.headers.cookie || '').session;
    if (!sessionCookie) return null;
    return jwt.verify(sessionCookie, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

/** Extract EncounterID, Name, Difficulty from the first line of a raw sheet. */
function parseHeader(raw) {
  const firstLine = raw.split('\n')[0] ?? '';
  const kv = {};
  for (const part of firstLine.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    kv[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
  }
  const id = parseInt(kv['EncounterID'] ?? '', 10);
  return isNaN(id) ? null : { encounterId: id, name: kv['Name'] ?? '', difficulty: kv['Difficulty'] ?? '' };
}

export default async function handler(req, res) {
  const user = getSession(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const { id } = req.query;

    // No id → return encounter index
    if (!id) {
      let index;
      try { index = await getEncounterIndex(); }
      catch { return res.status(503).json({ error: 'Storage unavailable, please try again' }); }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(index);
    }

    // id provided → return that sheet
    const encounterId = parseInt(id, 10);
    if (isNaN(encounterId)) return res.status(400).json({ error: 'id must be a number' });

    let data;
    try { data = await getCooldowns(encounterId); }
    catch { return res.status(503).json({ error: 'Storage unavailable, please try again' }); }
    if (!data) return res.status(404).json({ error: 'No sheet saved for that encounter' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { raw } = req.body ?? {};
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      return res.status(400).json({ error: 'Body must contain a non-empty "raw" string' });
    }

    const header = parseHeader(raw);
    if (!header) return res.status(400).json({ error: 'Could not parse EncounterID from header line' });

    try {
      await setCooldowns(header.encounterId, header.name, header.difficulty, raw);
    } catch {
      return res.status(500).json({ error: 'Failed to save cooldown sheet' });
    }
    return res.status(200).json({ ok: true, encounterId: header.encounterId });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
