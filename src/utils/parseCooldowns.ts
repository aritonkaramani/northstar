export interface CooldownEntry {
  time: number;
  phase: number;
  tag: string;
  spellId?: number;
  bossSpell?: number;
  text?: string;
}

export interface CooldownSheet {
  encounterId: number;
  difficulty: string;
  encounterName: string;
  entries: CooldownEntry[];
}

/** Parse semicolon-delimited key:value pairs from a single line into a map. */
function parseKV(line: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of line.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const key = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (key) map[key] = value;
  }
  return map;
}

/**
 * Parse a raw cooldown assignment string into a CooldownSheet.
 * Returns null if the header line is missing or malformed.
 */
export function parseCooldowns(raw: string): CooldownSheet | null {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // --- Parse header ---
  const header = parseKV(lines[0]);
  const encounterId = parseInt(header['EncounterID'] ?? '', 10);
  if (isNaN(encounterId)) return null;
  const difficulty = header['Difficulty'];
  const encounterName = header['Name'];
  if (!difficulty || !encounterName) return null;

  // --- Parse entries ---
  const entries: CooldownEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const kv = parseKV(lines[i]);

    const timeRaw = kv['time'];
    const phRaw = kv['ph'];
    const tag = kv['tag'];

    if (!timeRaw || !phRaw || !tag) continue;

    const time = parseInt(timeRaw, 10);
    const phase = parseInt(phRaw, 10);
    if (isNaN(time) || isNaN(phase)) continue;

    const entry: CooldownEntry = { time, phase, tag };

    const spellRaw = kv['spellid'];
    if (spellRaw !== undefined) {
      const spellId = parseInt(spellRaw, 10);
      if (!isNaN(spellId)) entry.spellId = spellId;
    }

    const bossRaw = kv['bossSpell'];
    if (bossRaw !== undefined) {
      const bossSpell = parseInt(bossRaw, 10);
      if (!isNaN(bossSpell)) entry.bossSpell = bossSpell;
    }

    const text = kv['text'];
    if (text !== undefined) entry.text = text;

    entries.push(entry);
  }

  return { encounterId, difficulty, encounterName, entries };
}
