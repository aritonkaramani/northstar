import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';
import { kv } from '@vercel/kv';

const RAID_DAYS = new Set([0, 1, 4]); // Sun=0, Mon=1, Thu=4

function getSession(req) {
  const cookie = parse(req.headers.cookie || '').session;
  if (!cookie) return null;
  try {
    return jwt.verify(cookie, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

// Returns all Thu/Sun/Mon dates from today through end of next calendar month
// as 'YYYY-MM-DD' strings in ascending order
function getRaidDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // JS Date handles month overflow natively: month+3, day 0 = last day of month+2
  const end = new Date(today.getFullYear(), today.getMonth() + 3, 0);

  const dates = [];
  const cursor = new Date(today);
  while (cursor <= end) {
    if (RAID_DAYS.has(cursor.getDay())) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// Returns raw mains array from KV, seeding from roster.config.json if missing
async function getMains() {
  let mains = await kv.get('roster:mains');
  if (!mains || !Array.isArray(mains)) {
    const configPath = join(process.cwd(), 'roster.config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    mains = config.mains ?? config.characters ?? [];
    await kv.set('roster:mains', mains);
  }
  return mains;
}

async function handleGet(req, res) {
  const [mains, raw] = await Promise.all([
    getMains(),
    kv.get('absence:data'),
  ]);
  const dates = getRaidDates();

  // Prune dates older than today from the stored map
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const data = raw ?? {};
  const staleKeys = Object.keys(data).filter((d) => d < todayStr);
  if (staleKeys.length > 0) {
    staleKeys.forEach((k) => delete data[k]);
    kv.set('absence:data', data).catch((e) => console.error('Prune write failed:', e));
  }

  res.status(200).json({
    dates,
    members: mains,
    attendance: data,
  });
}

async function handlePost(req, res) {
  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  const { date, entry, checked } = req.body ?? {};
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  const validDates = new Set(getRaidDates());
  if (!validDates.has(date)) {
    return res.status(400).json({ error: 'Date is not a scheduled raid day' });
  }
  if (!entry || typeof entry !== 'string') {
    return res.status(400).json({ error: 'Invalid entry' });
  }
  const mains = await getMains();
  const validEntries = new Set(mains.filter(e => e !== '---' && e !== ''));
  if (!validEntries.has(entry)) {
    return res.status(400).json({ error: 'Unknown member entry' });
  }
  if (typeof checked !== 'boolean') {
    return res.status(400).json({ error: 'checked must be boolean' });
  }

  const data = (await kv.get('absence:data')) ?? {};
  const current = Array.isArray(data[date]) ? data[date] : [];

  if (checked) {
    data[date] = current.includes(entry) ? current : [...current, entry];
  } else {
    data[date] = current.filter((e) => e !== entry);
    if (data[date].length === 0) delete data[date];
  }

  await kv.set('absence:data', data);
  res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Absence error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
