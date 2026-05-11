// api/sims-parse.js
// Pure CSV parsing and matrix building — no side effects, no KV, no HTTP

/**
 * Parse a droptimizer CSV filename into { name, spec }.
 * Name and spec are both lowercased.
 * Returns null if filename is invalid or spec is not a known WoW specialization.
 * Splits on the LAST underscore so multi-underscore names work (e.g. my_char_frost.csv).
 */
export function parseFilename(filename) {
  const base = filename.endsWith(".csv") ? filename.slice(0, -4) : filename;
  return parseIdentity(base);
}

/**
 * Extract { name, spec } from row 1's "name" column inside the CSV content itself.
 * Raidbots sets this to the same "name_spec" string as the filename.
 * Returns null if not found or spec not recognized.
 */
export function parseCsvIdentity(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = lines[0].split(",");
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) return null;
  const identity = lines[1].split(",")[nameIdx];
  if (!identity) return null;
  return parseIdentity(identity);
}

/**
 * Detect the raid difficulty embedded in item sim rows.
 * Item row name format: "zone/cat/raid-mythic/itemId/..."
 * Returns "mythic", "heroic", or null if not determinable.
 */
export function parseCsvDifficulty(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 3) return null;
  const header = lines[0].split(",");
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) return null;
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const parts = (cols[nameIdx] ?? "").split("/");
    if (parts.length < 3) continue;
    const diff = parts[2].toLowerCase();
    if (diff === "raid-mythic") return "mythic";
    if (diff === "raid-heroic") return "heroic";
  }
  return null;
}

function parseIdentity(str) {
  const s = str.toLowerCase().trim();
  if (!s) return null;
  const lastUnderscore = s.lastIndexOf("_");
  if (lastUnderscore === -1) return { name: s, spec: null };
  const name = s.slice(0, lastUnderscore);
  const spec = s.slice(lastUnderscore + 1);
  if (!name) return null;
  return { name, spec: spec || null };
}

/**
 * Parse a Raidbots droptimizer CSV (as a string) into a gains map.
 * Returns { [itemId: number]: dpsGain: number } — only items with gain > 0.
 *
 * CSV format:
 *   Row 0: header  (name,dps_mean,dps_min,...)
 *   Row 1: player's base sim  (dps_mean = base DPS)
 *   Row 2+: item sims  (name = "zone/cat/diff/itemId/ilvl/bonus/slot///")
 *
 * Gain formula: gain = Math.round(itemDPS - baseDPS)
 * Only positive gains stored. Same item twice → keep higher gain.
 */
export function parseDroptimizerCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 3) throw new Error("CSV has fewer than 3 rows");

  const header = lines[0].split(",");
  const nameIdx = header.indexOf("name");
  const dpsIdx = header.indexOf("dps_mean");
  if (nameIdx === -1 || dpsIdx === -1)
    throw new Error("CSV missing required columns: name, dps_mean");

  const baseRow = lines[1].split(",");
  const baseDPS = parseFloat(baseRow[dpsIdx]);
  if (isNaN(baseDPS)) throw new Error("Base DPS value is not a number");

  const gains = {};
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");
    const rowName = cols[nameIdx];
    const simDPS = parseFloat(cols[dpsIdx]);
    if (!rowName || isNaN(simDPS)) continue;

    const parts = rowName.split("/");
    if (parts.length < 4) continue;
    const itemId = parseInt(parts[3]);
    if (isNaN(itemId)) continue;

    const gain = Math.round(simDPS - baseDPS);
    if (gain > 0) {
      gains[itemId] = Math.max(gains[itemId] ?? 0, gain);
    }
  }

  return gains;
}

/**
 * Build the result matrix from all stored players and the full item list.
 *
 * @param {Array<{name, spec, gains}>} players
 * @param {Array<{id, name}>} formattedDrops — all items from formatted_itemdata.json drops
 * @returns {{ items: Array<{id,name}>, matrix: number[][] }}
 *   items: filtered to only items where ≥1 player has gain > 0
 *   matrix[i][j] = DPS gain for items[i] for players[j]
 */
export function buildMatrix(players, formattedDrops) {
  const items = formattedDrops.filter((item) =>
    players.some((p) => (p.gains[item.id] ?? 0) > 0),
  );
  const matrix = items.map((item) => players.map((p) => p.gains[item.id] ?? 0));
  return { items, matrix };
}
