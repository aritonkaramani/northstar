// api/clips/index.js
// GET /api/clips  — fetch all clips (auth required)
// POST /api/clips — add a clip (auth required)

import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';
import { parseClipUrl } from '../_clips-parse.js';
import { getClips, addClip } from '../_clips-kv.js';

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
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  // GET — return all clips
  if (req.method === 'GET') {
    const clips = await getClips();
    if (clips === null) return res.status(500).json({ error: 'Failed to load clips, please try again' });
    return res.status(200).json({ clips });
  }

  // POST — add a clip
  if (req.method === 'POST') {
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }

    if (!session?.sub || !session?.battleTag) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { url, title } = req.body ?? {};

    // URL validation
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }
    if (url.length > 2048) {
      return res.status(400).json({ error: 'URL is too long' });
    }

    // Rate limit: 1 per 30s per user (atomic SET NX)
    const rateLimitKey = `clips:ratelimit:${session.sub}`;
    let rateLimitSet = false;
    try {
      const acquired = await kv.set(rateLimitKey, '1', { nx: true, ex: 30 });
      if (!acquired) return res.status(429).json({ error: 'Please wait before adding another clip' });
      rateLimitSet = true;
    } catch (err) {
      console.error('[clips] rate limit check failed:', err);
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    // Parse URL
    let platform, clipId;
    try {
      ({ platform, clipId } = parseClipUrl(url));
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Sanitise title
    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 100) : '';

    const clip = {
      id: crypto.randomUUID(),
      url,
      platform,
      clipId,
      title: cleanTitle,
      addedBy: session.battleTag,
      addedById: session.sub,
      addedAt: Math.floor(Date.now() / 1000),
    };

    const result = await addClip(clip);
    if (result.error) {
      if (rateLimitSet) {
        try { await kv.del(rateLimitKey); } catch {}
      }
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(201).json(result);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
