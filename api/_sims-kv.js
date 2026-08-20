// api/sims-kv.js
// All Vercel KV read/write operations for the sims feature.
// All endpoints import from here — never import @vercel/kv directly in endpoint files.

import { kv } from '@vercel/kv';

/** Canonical KV key for a player entry */
export function playerKey(difficulty, name, spec) {
  return spec ? `sims:${difficulty}:player:${name}_${spec}` : `sims:${difficulty}:player:${name}`;
}

/** Returns array of all player KV keys for a difficulty, or [] if none */
export async function getPlayerKeys(difficulty) {
  try {
    const keys = await kv.get(`sims:${difficulty}:playerkeys`);
    return keys ?? [];
  } catch { return []; }
}

/**
 * Add a player key to the playerkeys list — deduplicated.
 * Must be called after every upload (including re-uploads).
 */
export async function addPlayerKey(difficulty, key) {
  try {
    const keys = await getPlayerKeys(difficulty);
    if (!keys.includes(key)) {
      keys.push(key);
      await kv.set(`sims:${difficulty}:playerkeys`, keys);
    }
  } catch (e) { console.error('[sims-kv] addPlayerKey failed:', e?.message); }
}

/**
 * Fetch all stored player objects for a difficulty.
 * Returns Array<{ name, spec, battletag, uploadedAt, gains }>.
 */
export async function getAllPlayers(difficulty) {
  try {
    const keys = await getPlayerKeys(difficulty);
    if (keys.length === 0) return [];
    const players = await Promise.all(keys.map(k => kv.get(k)));
    return players.filter(Boolean);
  } catch (e) { console.error('[sims-kv] getAllPlayers failed:', e?.message); return []; }
}

/** Returns uploaders array for a difficulty, or [] */
export async function getUploaders(difficulty) {
  try {
    const uploaders = await kv.get(`sims:${difficulty}:uploaders`);
    return uploaders ?? [];
  } catch (e) { console.error('[sims-kv] getUploaders failed:', e?.message); return []; }
}

/**
 * Upsert an uploader entry by { name, spec }.
 */
export async function upsertUploader(difficulty, entry) {
  try {
    const uploaders = await getUploaders(difficulty);
    const idx = uploaders.findIndex(u => u.name === entry.name && u.spec === entry.spec);
    if (idx !== -1) uploaders[idx] = entry;
    else uploaders.push(entry);
    await kv.set(`sims:${difficulty}:uploaders`, uploaders);
  } catch (e) { console.error('[sims-kv] upsertUploader failed:', e?.message); }
}

/**
 * Store a single player's data in KV.
 */
export async function setPlayerData(key, playerData) {
  try {
    await kv.set(key, playerData);
  } catch (e) { console.error('[sims-kv] setPlayerData failed:', e?.message); }
}

/**
 * Store the computed result matrix in KV.
 */
export async function setResult(difficulty, result) {
  try {
    await kv.set(`sims:${difficulty}:result`, result);
  } catch (e) { console.error('[sims-kv] setResult failed:', e?.message); }
}

/**
 * Reset a difficulty: delete all player entries, playerkeys, uploaders, and result.
 */
export async function resetDifficulty(difficulty) {
  try {
    const keys = await getPlayerKeys(difficulty);
    await Promise.all([
      ...keys.map(k => kv.del(k)),
      kv.del(`sims:${difficulty}:playerkeys`),
      kv.del(`sims:${difficulty}:uploaders`),
      kv.del(`sims:${difficulty}:result`),
    ]);
  } catch (e) { console.error('[sims-kv] resetDifficulty failed:', e?.message); }
}

/**
 * Remove all player entries for a given battletag from a difficulty.
 * Returns the remaining players array (after deletion) for matrix rebuild.
 */
export async function removePlayerByBattletag(difficulty, battletag) {
  try {
    const keys = await getPlayerKeys(difficulty);
    const players = await Promise.all(keys.map(k => kv.get(k)));
    const toDelete = keys.filter((_, i) => players[i]?.battletag === battletag);
    const remaining = players.filter((p, i) => p && keys[i] && !toDelete.includes(keys[i]));
    const remainingKeys = keys.filter(k => !toDelete.includes(k));

    await Promise.all(toDelete.map(k => kv.del(k)));
    await kv.set(`sims:${difficulty}:playerkeys`, remainingKeys);

    const uploaders = await getUploaders(difficulty);
    const newUploaders = uploaders.filter(u => u.battletag !== battletag);
    await kv.set(`sims:${difficulty}:uploaders`, newUploaders);

    return remaining;
  } catch (e) {
    console.error('[sims-kv] removePlayerByBattletag failed:', e?.message);
    return [];
  }
}
