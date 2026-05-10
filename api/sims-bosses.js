// api/sims-bosses.js
// GET /api/sims-bosses
// Returns all raids with their bosses and the item IDs that drop from each boss.
// Data is purely static — no KV, no auth required.

import { readFileSync } from 'fs';
import { join } from 'path';

let cached = null;

function buildBossData() {
  if (cached) return cached;

  const instances = JSON.parse(readFileSync(join(process.cwd(), 'static_data/instances.json'), 'utf8'));
  const items = JSON.parse(readFileSync(join(process.cwd(), 'static_data/encounter-items.json'), 'utf8'));

  // Build a map: encounterId → array of { id, name }
  const itemsByEncounter = {};
  for (const item of items) {
    for (const src of (item.sources ?? [])) {
      if (!itemsByEncounter[src.encounterId]) itemsByEncounter[src.encounterId] = [];
      itemsByEncounter[src.encounterId].push({ id: item.id, name: item.name });
    }
  }

  const raids = instances.map(raid => ({
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

  cached = raids;
  return raids;
}

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    res.status(200).json(buildBossData());
  } catch (e) {
    res.status(500).json({ error: 'Failed to load boss data: ' + e.message });
  }
}
