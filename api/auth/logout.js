export default function handler(req, res) {
  res.setHeader(
    "Set-Cookie",
    "session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/",
  );
  res.status(200).json({ ok: true });
}
