import { parse } from "cookie";
import jwt from "jsonwebtoken";

export default function handler(req, res) {
  try {
    const sessionCookie = parse(req.headers.cookie || "").session;
    if (!sessionCookie) return res.status(401).json({ error: "Not authenticated" });

    const { sub, battleTag, verified } = jwt.verify(sessionCookie, process.env.JWT_SECRET);
    const adminBattletag = process.env.ADMIN_BATTLETAG;
    const isAdmin = !!adminBattletag && battleTag === adminBattletag;
    // sub is absent on tokens minted before the clips feature — graceful degradation
    res.status(200).json({ id: sub ?? null, battleTag, verified, isAdmin });
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
