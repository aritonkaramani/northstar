// api/_cooldowns-kv.js
// All Vercel KV read/write for the cooldowns feature.
// Endpoint files import from here — never import @vercel/kv directly.

import { kv } from "@vercel/kv";

const INDEX_KEY = "cooldowns:index"; // list of { encounterId, name, difficulty, savedAt }
const sheetKey = (id) => `cooldowns:encounter:${id}`;

/**
 * Returns the encounter index array, or [] if none saved.
 * @returns {Promise<Array<{encounterId: number, name: string, difficulty: string, savedAt: string}>>}
 */
export async function getEncounterIndex() {
  try {
    return (await kv.get(INDEX_KEY)) ?? [];
  } catch (e) {
    console.error("[cooldowns-kv] getEncounterIndex failed:", e?.message);
    throw e;
  }
}

/**
 * Fetch the stored cooldown sheet for a specific encounter.
 * Returns { raw: string, savedAt: string } or null if not found.
 * Throws on KV error.
 */
export async function getCooldowns(encounterId) {
  try {
    return await kv.get(sheetKey(encounterId));
  } catch (e) {
    console.error("[cooldowns-kv] getCooldowns failed:", e?.message);
    throw e;
  }
}

/**
 * Save a cooldown sheet and update the encounter index.
 * @param {number} encounterId
 * @param {string} name - Encounter name
 * @param {string} difficulty
 * @param {string} raw - Raw pasted text (stored verbatim)
 */
export async function setCooldowns(encounterId, name, difficulty, raw) {
  const savedAt = new Date().toISOString();
  try {
    await kv.set(sheetKey(encounterId), { raw, savedAt });
    // Upsert entry in index
    const index = (await kv.get(INDEX_KEY)) ?? [];
    const i = index.findIndex((e) => e.encounterId === encounterId);
    const entry = { encounterId, name, difficulty, savedAt };
    if (i !== -1) index[i] = entry;
    else index.push(entry);
    await kv.set(INDEX_KEY, index);
  } catch (e) {
    console.error("[cooldowns-kv] setCooldowns failed:", e?.message);
    throw e;
  }
}
