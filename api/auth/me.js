import { parse } from "cookie";
import jwt from "jsonwebtoken";

export default function handler(req, res) {
  try {
    const sessionCookie = parse(req.headers.cookie || "").session;
    if (!sessionCookie) return res.status(401).json({ error: "Not authenticated" });

    const { battleTag, verified } = jwt.verify(sessionCookie, process.env.JWT_SECRET);
    res.status(200).json({ battleTag, verified });
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
