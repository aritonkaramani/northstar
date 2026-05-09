import cookie from 'cookie';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { code, state } = req.query;
  const cookies = cookie.parse(req.headers.cookie || '');

  // CSRF check
  if (!state || state !== cookies.oauth_state) {
    return res.redirect(302, '/?error=state_mismatch');
  }

  // Clear the oauth_state cookie
  res.setHeader('Set-Cookie', 'oauth_state=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/');

  try {
    // Exchange code for access token
    const credentials = Buffer.from(
      `${process.env.BNET_CLIENT_ID}:${process.env.BNET_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await fetch('https://oauth.battle.net/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.BNET_CALLBACK_URL,
      }),
    });

    if (!tokenRes.ok) return res.redirect(302, '/?error=auth_failed');
    const { access_token } = await tokenRes.json();

    // Fetch WoW profile to verify guild membership
    const profileRes = await fetch('https://eu.api.blizzard.com/profile/user/wow', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Battlenet-Namespace': 'profile-eu',
      },
    });

    if (!profileRes.ok) return res.redirect(302, '/?error=api_error');
    const profile = await profileRes.json();

    // Check if any character is in Northstar on Ravencrest
    const isMember = profile.wow_accounts?.some((account) =>
      account.characters?.some(
        (char) =>
          char.guild?.name?.toLowerCase() === 'northstar' &&
          char.guild?.realm?.slug?.toLowerCase() === 'ravencrest'
      )
    );

    if (!isMember) return res.redirect(302, '/?error=not_a_member');

    // Sign a session JWT and set it as an HTTP-only cookie
    const token = jwt.sign(
      { battleTag: profile.battletag, verified: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = [
      `session=${token}`,
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=604800',
      'Path=/',
      isProd ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');

    res.setHeader('Set-Cookie', cookieOptions);
    res.redirect(302, '/members');
  } catch {
    res.redirect(302, '/?error=auth_failed');
  }
}
