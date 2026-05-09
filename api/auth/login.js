import crypto from "crypto";

export default function handler(req, res) {
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a short-lived cookie for CSRF protection
  res.setHeader(
    "Set-Cookie",
    `oauth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`,
  );

  const params = new URLSearchParams({
    client_id: process.env.BNET_CLIENT_ID,
    redirect_uri: process.env.BNET_CALLBACK_URL,
    response_type: "code",
    scope: "wow.profile openid",
    state,
  });

  res.redirect(302, `https://oauth.battle.net/authorize?${params}`);
}
