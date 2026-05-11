// api/clips-kv.js
// All Vercel KV operations for the clips feature.

import { kv } from '@vercel/kv';
import { buildEmbedUrl } from './_clips-parse.js';

const CLIPS_KEY = 'clips:all';
const LOCK_KEY = 'clips:lock';
const LOCK_TTL = 5; // seconds
const MAX_CLIPS = 500;

/** Acquire a mutex lock. Returns true if acquired, false if already locked. */
async function acquireLock() {
  // SET NX EX — only sets if key doesn't exist
  const result = await kv.set(LOCK_KEY, '1', { nx: true, ex: LOCK_TTL });
  return result === 'OK';
}

async function releaseLock() {
  try {
    await kv.del(LOCK_KEY);
  } catch (err) {
    console.error('[clips-kv] releaseLock error (lock will expire via TTL):', err);
  }
}

/** Add embedUrl to clips at read time (never stored). */
function hydrateClips(clips) {
  return clips.map((c) => {
    try {
      return { ...c, embedUrl: buildEmbedUrl(c.platform, c.clipId) };
    } catch {
      console.error('[clips-kv] hydrateClips: skipping malformed clip', c.id, c.platform);
      return { ...c, embedUrl: null };
    }
  });
}

/** GET all clips, hydrated with embedUrl. Returns null on KV error. */
export async function getClips() {
  try {
    const clips = await kv.get(CLIPS_KEY);
    return hydrateClips(clips ?? []);
  } catch (err) {
    console.error('[clips-kv] getClips error:', err);
    return null; // caller returns 500
  }
}

/**
 * Add a clip.
 * @returns {{ ok: true, clip: object } | { error: string, status: number }}
 */
export async function addClip(clipData) {
  let locked = false;
  try {
    locked = await acquireLock();
    if (!locked) return { error: 'Server busy, please try again', status: 429 };

    const clips = await kv.get(CLIPS_KEY) ?? [];

    // Dedup: same platform:clipId
    const dupKey = `${clipData.platform}:${clipData.clipId}`;
    const isDuplicate = clips.some((c) => `${c.platform}:${c.clipId}` === dupKey);
    if (isDuplicate) return { error: 'This clip has already been added', status: 400 };

    // Prepend newest first, cap at MAX_CLIPS
    const updated = [clipData, ...clips].slice(0, MAX_CLIPS);
    await kv.set(CLIPS_KEY, updated);

    return { ok: true, clip: { ...clipData, embedUrl: buildEmbedUrl(clipData.platform, clipData.clipId) } };
  } catch (err) {
    console.error('[clips-kv] addClip error:', err);
    return { error: 'Failed to save clip, please try again', status: 500 };
  } finally {
    if (locked) await releaseLock();
  }
}

/**
 * Remove a clip by id, checking ownership.
 * @returns {{ ok: true } | { error: string, status: number }}
 */
export async function removeClip(id, accountId) {
  let locked = false;
  try {
    locked = await acquireLock();
    if (!locked) return { error: 'Server busy, please try again', status: 429 };

    const clips = await kv.get(CLIPS_KEY) ?? [];
    const idx = clips.findIndex((c) => c.id === id);

    if (idx === -1) return { error: 'Clip not found', status: 404 };
    if (clips[idx].addedById !== accountId) return { error: 'Forbidden', status: 403 };

    const updated = clips.filter((_, i) => i !== idx);
    await kv.set(CLIPS_KEY, updated);

    return { ok: true };
  } catch (err) {
    console.error('[clips-kv] removeClip error:', err);
    return { error: 'Failed to delete clip, please try again', status: 500 };
  } finally {
    if (locked) await releaseLock();
  }
}
