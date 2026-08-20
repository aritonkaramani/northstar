// api/sims.js
// Consolidated sims endpoint (replaces sims-bosses, sims-status, sims-result, sims-upload)
//
// GET  /api/sims?resource=bosses                          — static boss/item data (no auth)
// GET  /api/sims?resource=status&difficulty=mythic|heroic — upload status
// GET  /api/sims?resource=result&difficulty=mythic|heroic — sim results
// DELETE /api/sims?resource=result&difficulty=...         — GM-only reset
// POST /api/sims                                          — upload CSV (multipart)

import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';
import { kv } from '@vercel/kv';
import formidable from 'formidable';
import { parseFilename, parseCsvIdentity, parseCsvDifficulty, parseDroptimizerCSV, buildMatrix } from './_sims-parse.js';
import { playerKey, addPlayerKey, getAllPlayers, upsertUploader, setPlayerData, setResult, getUploaders, resetDifficulty, removePlayerByBattletag } from './_sims-kv.js';

// Disable body parser so formidable can handle multipart uploads
export const config = { api: { bodyParser: false } };

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

// ── Static boss/item data ─────────────────────────────────────────────────────

let bossDataCache = null;

function buildBossData() {
  if (bossDataCache) return bossDataCache;
  const instances = JSON.parse(readFileSync(join(process.cwd(), 'static_data/instances.json'), 'utf8'));
  const items = JSON.parse(readFileSync(join(process.cwd(), 'static_data/encounter-items.json'), 'utf8'));
  const itemsByEncounter = {};
  for (const item of items) {
    for (const src of (item.sources ?? [])) {
      if (!itemsByEncounter[src.encounterId]) itemsByEncounter[src.encounterId] = [];
      itemsByEncounter[src.encounterId].push({ id: item.id, name: item.name });
    }
  }
  bossDataCache = instances.map(raid => ({
    id: raid.id,
    name: raid.name,
    bosses: [...raid.encounters]
      .sort((a, b) => a.order - b.order)
      .map(enc => ({
        id: enc.id,
        name: enc.name,
        icon: enc.icon,
        items: itemsByEncounter[enc.id] ?? [],
      })),
  }));
  return bossDataCache;
}

// ── Status helper ─────────────────────────────────────────────────────────────

function getExpectedPlayers() {
  try {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'roster.config.json'), 'utf8'));
    const mains = config.mains ?? config.characters ?? [];
    return mains
      .filter(entry => entry && entry !== '---')
      .map(entry => {
        const dashIdx = entry.indexOf('-');
        return (dashIdx === -1 ? entry : entry.slice(0, dashIdx)).toLowerCase();
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const { resource, difficulty: rawDifficulty } = req.query;

  // ── GET /api/sims?resource=bosses (no auth) ───────────────────────────────
  if (req.method === 'GET' && resource === 'bosses') {
    try {
      return res.status(200).json(buildBossData());
    } catch (e) {
      return res.status(500).json({ error: 'Failed to load boss data: ' + e.message });
    }
  }

  // All other routes require auth
  const user = getSession(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  // ── GET /api/sims?resource=status&difficulty=... ──────────────────────────
  if (req.method === 'GET' && resource === 'status') {
    const difficulty = rawDifficulty?.toLowerCase();
    if (!VALID_DIFFICULTIES.has(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be "mythic" or "heroic"' });
    }
    const [uploaders, expected] = await Promise.all([
      getUploaders(difficulty),
      Promise.resolve(getExpectedPlayers()),
    ]);
    return res.status(200).json({ uploaders, expected });
  }

  // ── GET /api/sims?resource=result&difficulty=... ──────────────────────────
  if (req.method === 'GET' && resource === 'result') {
    const difficulty = rawDifficulty?.toLowerCase();
    if (!VALID_DIFFICULTIES.has(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be "mythic" or "heroic"' });
    }
    try {
      const result = await kv.get(`sims:${difficulty}:result`);
      if (!result) return res.status(200).json({ items: [], players: [], matrix: [] });
      return res.status(200).json(result);
    } catch {
      return res.status(200).json({ items: [], players: [], matrix: [] });
    }
  }

  // ── DELETE /api/sims?resource=result&difficulty=... (GM only) ────────────
  if (req.method === 'DELETE' && resource === 'result') {
    const difficulty = rawDifficulty?.toLowerCase();
    if (!VALID_DIFFICULTIES.has(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be "mythic" or "heroic"' });
    }
    const adminBattletag = process.env.ADMIN_BATTLETAG;
    if (!adminBattletag || user.battleTag !== adminBattletag) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await resetDifficulty(difficulty);
    return res.status(200).json({ ok: true, difficulty });
  }

  // ── DELETE /api/sims?resource=myupload&difficulty=... (any user) ──────────
  if (req.method === 'DELETE' && resource === 'myupload') {
    const difficulty = rawDifficulty?.toLowerCase();
    if (!VALID_DIFFICULTIES.has(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be "mythic" or "heroic"' });
    }
    const remaining = await removePlayerByBattletag(difficulty, user.battleTag);
    const itemData = JSON.parse(
      readFileSync(join(process.cwd(), 'static_data/formatted_itemdata.json'), 'utf8')
    );
    if (remaining.length > 0) {
      const { items, matrix } = buildMatrix(remaining, itemData.drops);
      await setResult(difficulty, {
        items,
        players: remaining.map(p => ({ name: p.name, spec: p.spec })),
        matrix,
      });
    } else {
      await setResult(difficulty, { items: [], players: [], matrix: [] });
    }
    return res.status(200).json({ ok: true });
  }

  // ── POST /api/sims (CSV upload) ───────────────────────────────────────────
  if (req.method === 'POST') {
    const form = formidable({ maxFileSize: 50 * 1024 });
    let fields, files;
    try {
      [fields, files] = await form.parse(req);
    } catch (err) {
      return res.status(400).json({ error: 'Failed to parse upload: ' + err.message });
    }

    const difficulty = (Array.isArray(fields.difficulty) ? fields.difficulty[0] : fields.difficulty)?.toLowerCase();
    if (!VALID_DIFFICULTIES.has(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be "mythic" or "heroic"' });
    }

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file field in upload' });

    const csvText = readFileSync(file.filepath, 'utf8');
    let gains;
    try {
      gains = parseDroptimizerCSV(csvText);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid CSV format: ' + err.message });
    }

    const parsed = parseCsvIdentity(csvText) ?? parseFilename(file.originalFilename || '');
    if (!parsed) {
      return res.status(400).json({ error: 'Could not determine character name and spec. Make sure you are uploading a Raidbots droptimizer CSV.' });
    }
    const { name, spec } = parsed;

    const csvDifficulty = parseCsvDifficulty(csvText);
    if (csvDifficulty && csvDifficulty !== difficulty) {
      return res.status(400).json({
        error: `This CSV contains ${csvDifficulty} data but you are uploading to ${difficulty}. Please select the correct difficulty tab.`,
      });
    }

    const key = playerKey(difficulty, name, spec);
    const playerData = {
      name,
      spec,
      battletag: user.battleTag ?? 'unknown',
      uploadedAt: new Date().toISOString(),
      gains,
    };
    await setPlayerData(key, playerData);
    await addPlayerKey(difficulty, key);
    await upsertUploader(difficulty, {
      name,
      spec,
      battletag: playerData.battletag,
      uploadedAt: playerData.uploadedAt,
    });

    const allPlayers = await getAllPlayers(difficulty);
    const itemData = JSON.parse(
      readFileSync(join(process.cwd(), 'static_data/formatted_itemdata.json'), 'utf8')
    );
    const { items, matrix } = buildMatrix(allPlayers, itemData.drops);
    await setResult(difficulty, {
      items,
      players: allPlayers.map(p => ({ name: p.name, spec: p.spec })),
      matrix,
    });

    return res.status(200).json({ ok: true, name, spec, playerCount: allPlayers.length });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
