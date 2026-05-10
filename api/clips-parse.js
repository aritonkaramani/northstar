// api/clips-parse.js
// Pure URL parser for Twitch clip and YouTube video URLs.
// Returns { platform, clipId } or throws Error with user-facing message.

/**
 * @param {string} rawUrl
 * @returns {{ platform: 'twitch'|'youtube', clipId: string }}
 * @throws {Error} with .message suitable for showing to the user
 */
export function parseClipUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Not a recognised Twitch or YouTube URL');
  }
  if (rawUrl.length > 2048) {
    throw new Error('URL is too long');
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Not a recognised Twitch or YouTube URL');
  }

  // Normalise hostname: strip www. and m. prefixes (handles www.m.twitch.tv too)
  const host = url.hostname.replace(/^(?:www\.|m\.)+/, '');

  // --- Twitch ---
  if (host === 'clips.twitch.tv') {
    // https://clips.twitch.tv/{slug}
    const slug = url.pathname.replace(/^\//, '').split('/')[0];
    if (!slug) throw new Error('Not a recognised Twitch or YouTube URL');
    return { platform: 'twitch', clipId: slug };
  }

  if (host === 'twitch.tv') {
    // https://twitch.tv/{channel}/clip/{slug}
    const parts = url.pathname.replace(/^\//, '').split('/');
    if (parts[1] === 'clip' && parts[2]) {
      return { platform: 'twitch', clipId: parts[2] };
    }
    throw new Error('Not a recognised Twitch or YouTube URL');
  }

  // --- YouTube ---
  if (host === 'youtube.com') {
    // Reject /clip/ URLs explicitly with helpful message
    if (url.pathname.startsWith('/clip/')) {
      throw new Error('YouTube clip URLs are not supported; paste the full video URL instead');
    }

    // /watch?v=...
    if (url.pathname === '/watch') {
      const videoId = url.searchParams.get('v');
      if (!videoId) throw new Error('Not a recognised Twitch or YouTube URL');
      return { platform: 'youtube', clipId: videoId };
    }

    // /shorts/{id} or /embed/{id}
    const parts = url.pathname.replace(/^\//, '').split('/');
    if ((parts[0] === 'shorts' || parts[0] === 'embed') && parts[1]) {
      return { platform: 'youtube', clipId: parts[1] };
    }

    throw new Error('Not a recognised Twitch or YouTube URL');
  }

  if (host === 'youtu.be') {
    // https://youtu.be/{videoId}
    const videoId = url.pathname.replace(/^\//, '').split('/')[0];
    if (!videoId) throw new Error('Not a recognised Twitch or YouTube URL');
    return { platform: 'youtube', clipId: videoId };
  }

  throw new Error('Not a recognised Twitch or YouTube URL');
}

/**
 * Compute the iframe embed URL from stored platform + clipId.
 * Called at read time — never stored in KV.
 * @param {'twitch'|'youtube'} platform
 * @param {string} clipId
 * @returns {string}
 * @throws {TypeError} if platform is unknown or clipId is invalid
 */
export function buildEmbedUrl(platform, clipId) {
  if (!clipId || typeof clipId !== 'string') {
    throw new TypeError('buildEmbedUrl: clipId must be a non-empty string');
  }
  if (platform === 'twitch') {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clipId)}&parent=northstarguild.com&autoplay=false&muted=true`;
  }
  if (platform === 'youtube') {
    return `https://www.youtube.com/embed/${encodeURIComponent(clipId)}?autoplay=0`;
  }
  throw new TypeError(`buildEmbedUrl: unknown platform "${platform}"`);
}
