// api/clips/[id].js
// DELETE /api/clips/:id — remove a clip (owner only)

import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';
import { removeClip } from '../clips-kv.js';

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
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing clip id' });

  // Rate limit: 1 delete per 5s per user (atomic SET NX to avoid TOCTOU)
  const rateLimitKey = `clips:ratelimit:del:${session.sub}`;
  let rateLimitSet = false;
  try {
    const acquired = await kv.set(rateLimitKey, '1', { nx: true, ex: 5 });
    if (!acquired) return res.status(429).json({ error: 'Please wait before deleting another clip' });
    rateLimitSet = true;
  } catch (err) {
    console.error('[clips/[id]] rate limit KV error:', err);
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  const result = await removeClip(id, session.sub);
  if (result.error) {
    // Release rate limit on server errors so the user can retry
    if (rateLimitSet && (result.status ?? 500) >= 500) {
      try { await kv.del(rateLimitKey); } catch {}
    }
    return res.status(result.status ?? 500).json({ error: result.error });
  }
  return res.status(200).json({ ok: true });
}
