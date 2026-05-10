// api/sims-upload.js
// POST /api/sims-upload
// Body: multipart/form-data with fields: file (CSV), difficulty ("mythic"|"heroic")

import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';
import formidable from 'formidable';
import { parseFilename, parseCsvIdentity, parseCsvDifficulty, parseDroptimizerCSV, buildMatrix } from './sims-parse.js';
import { playerKey, addPlayerKey, getAllPlayers, upsertUploader, setPlayerData, setResult } from './sims-kv.js';

// Required: disable Vercel's built-in body parser so formidable can read the stream
export const config = { api: { bodyParser: false } };

const VALID_DIFFICULTIES = new Set(['mythic', 'heroic']);

function authUser(req) {
  try {
    const sessionCookie = parseCookie(req.headers.cookie || '').session;
    if (!sessionCookie) return null;
    return jwt.verify(sessionCookie, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  // Parse multipart form — formidable v3 returns a promise
  const form = formidable({ maxFileSize: 50 * 1024 }); // 50KB limit
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (err) {
    return res.status(400).json({ error: 'Failed to parse upload: ' + err.message });
  }

  // Extract and validate difficulty (formidable v3: fields are arrays)
  const difficulty = (Array.isArray(fields.difficulty) ? fields.difficulty[0] : fields.difficulty)?.toLowerCase();
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be "mythic" or "heroic"' });
  }

  // Extract file (formidable v3: files are arrays)
  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file) return res.status(400).json({ error: 'No file field in upload' });

  // Parse CSV content first (we need it to extract identity from row 1)
  const csvText = readFileSync(file.filepath, 'utf8');
  let gains;
  try {
    gains = parseDroptimizerCSV(csvText);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid CSV format: ' + err.message });
  }

  // Extract name+spec from CSV content (row 1 "name" column), fall back to filename
  const parsed = parseCsvIdentity(csvText) ?? parseFilename(file.originalFilename || '');
  if (!parsed) {
    return res.status(400).json({ error: 'Could not determine character name and spec. Make sure you are uploading a Raidbots droptimizer CSV.' });
  }
  const { name, spec } = parsed;

  // Validate that the CSV difficulty matches the selected tab
  const csvDifficulty = parseCsvDifficulty(csvText);
  if (csvDifficulty && csvDifficulty !== difficulty) {
    return res.status(400).json({
      error: `This CSV contains ${csvDifficulty} data but you are uploading to ${difficulty}. Please select the correct difficulty tab.`,
    });
  }

  // Store player data in KV
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

  // Recompute full result matrix from all stored players
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

  res.status(200).json({ ok: true, name, spec, playerCount: allPlayers.length });
}
