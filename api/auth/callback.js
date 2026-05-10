import { parse } from "cookie";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  const { code, state } = req.query;
  const cookies = parse(req.headers.cookie || "");

  // CSRF check
  if (!state || state !== cookies.oauth_state) {
    return res.redirect(302, "/?error=state_mismatch");
  }

  // Clear the oauth_state cookie
  res.setHeader(
    "Set-Cookie",
    "oauth_state=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/",
  );

  try {
    const credentials = Buffer.from(
      `${process.env.BNET_CLIENT_ID}:${process.env.BNET_CLIENT_SECRET}`,
    ).toString("base64");

    // Exchange code for user access token
    const tokenRes = await fetch("https://oauth.battle.net/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.BNET_CALLBACK_URL,
      }),
    });

    if (!tokenRes.ok) return res.redirect(302, "/?error=auth_failed");
    const { access_token } = await tokenRes.json();

    // Get client credentials token (needed for guild roster API)
    const ccRes = await fetch("https://oauth.battle.net/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });

    if (!ccRes.ok) return res.redirect(302, "/?error=api_error");
    const { access_token: ccToken } = await ccRes.json();

    // Get user's character list and BattleTag (userinfo gives battletag reliably)
    const [profileRes, userinfoRes] = await Promise.all([
      fetch(
        "https://eu.api.blizzard.com/profile/user/wow?namespace=profile-eu&locale=en_GB",
        { headers: { Authorization: `Bearer ${access_token}` } },
      ),
      fetch("https://oauth.battle.net/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
    ]);

    if (!profileRes.ok || !userinfoRes.ok)
      return res.redirect(302, "/?error=api_error");
    const [profile, userinfo] = await Promise.all([
      profileRes.json(),
      userinfoRes.json(),
    ]);

    if (!userinfo?.id) return res.redirect(302, "/?error=api_error");

    // Collect all character IDs the user owns
    const characterIds = new Set(
      profile.wow_accounts?.flatMap(
        (acc) => acc.characters?.map((c) => c.id) ?? [],
      ) ?? [],
    );

    // Get Northstar guild roster using client credentials
    const rosterRes = await fetch(
      "https://eu.api.blizzard.com/data/wow/guild/ravencrest/northstar/roster?namespace=profile-eu&locale=en_GB",
      { headers: { Authorization: `Bearer ${ccToken}` } },
    );

    if (!rosterRes.ok) return res.redirect(302, "/?error=api_error");
    const roster = await rosterRes.json();

    // Check if any of the user's characters are in the roster
    const isMember = roster.members?.some((m) =>
      characterIds.has(m.character.id),
    );

    if (!isMember) return res.redirect(302, "/?error=not_a_member");

    // Sign session JWT and set HTTP-only cookie
    const token = jwt.sign(
      { sub: String(userinfo.id), battleTag: userinfo.battletag, verified: true },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    const isProd = process.env.NODE_ENV === "production";
    const cookieOptions = [
      `session=${token}`,
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=604800",
      "Path=/",
      isProd ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    res.setHeader("Set-Cookie", cookieOptions);
    res.redirect(302, "/members");
  } catch (err) {
    console.error("Auth callback error:", err);
    res.redirect(302, "/?error=auth_failed");
  }
}
