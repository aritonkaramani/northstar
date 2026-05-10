import { parse } from "cookie";
import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { join } from "path";
import { kv } from "@vercel/kv";

// Official WoW class colours
const CLASS_COLORS = {
  "Death Knight": "#C41E3A",
  "Demon Hunter": "#A330C9",
  Druid: "#FF7C0A",
  Evoker: "#33937F",
  Hunter: "#AAD372",
  Mage: "#3FC7EB",
  Monk: "#00FF98",
  Paladin: "#F48CBA",
  Priest: "#FFFFFF",
  Rogue: "#FFF468",
  Shaman: "#0070DD",
  Warlock: "#8788EE",
  Warrior: "#C79C6E",
};

// Convert CamelCase realm name to hyphenated slug (e.g. TwistingNether → twisting-nether)
function toRealmSlug(realm) {
  return realm
    .replace(/([A-Z])/g, (m, l, offset) => (offset > 0 ? "-" : "") + l)
    .toLowerCase()
    .replace(/^-/, "");
}

// Parse "Name" or "Name-Realm" into { name, realm } — or a separator/empty marker
function parseCharacter(entry) {
  if (entry === "---") return { separator: true };
  if (entry === "") return { empty: true };
  const dashIndex = entry.indexOf("-");
  if (dashIndex === -1) return { name: entry, realm: "ravencrest", _entry: entry };
  return {
    name: entry.slice(0, dashIndex),
    realm: toRealmSlug(entry.slice(dashIndex + 1)),
    _entry: entry,
  };
}

async function enrichCharacter(char) {
  if (char.separator) return { separator: true };
  if (char.empty) return { empty: true };

  const { name, realm, _entry } = char;
  const rioRes = await fetch(
    `https://raider.io/api/v1/characters/profile?region=eu&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=mythic_plus_weekly_highest_level_runs,gear`,
  );
  const rio = rioRes.ok ? await rioRes.json() : null;

  // Sort runs best-first so vault slot positions are correct
  const weeklyRuns = (rio?.mythic_plus_weekly_highest_level_runs ?? [])
    .slice()
    .sort((a, b) => (b.mythic_level ?? 0) - (a.mythic_level ?? 0));

  const keysThisWeek = weeklyRuns.length;
  const highestKey = weeklyRuns[0]?.mythic_level ?? 0;

  // Vault unlocks at 1, 4, 8 keys — each slot shows the key level at that position
  const vaultSlots = [
    weeklyRuns[0]?.mythic_level ?? null,
    weeklyRuns[3]?.mythic_level ?? null,
    weeklyRuns[7]?.mythic_level ?? null,
  ];

  const className = rio?.class ?? null;
  const classColor = CLASS_COLORS[className] ?? "#cccccc";

  return {
    name: rio?.name ?? name,
    realm,
    className,
    classColor,
    itemLevel: Math.round(rio?.gear?.item_level_equipped ?? 0),
    keysThisWeek,
    highestKey,
    vaultSlots,
    _entry,
  };
}

function buildList(results) {
  const items = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  // Only auto-sort if there are no separators (separators imply intentional order)
  const hasSeparators = items.some((m) => m.separator || m.empty);
  if (!hasSeparators) items.sort((a, b) => b.itemLevel - a.itemLevel);
  return items;
}

async function getSection(section) {
  const key = `roster:${section}`;
  let entries = await kv.get(key);
  if (!entries || !Array.isArray(entries)) {
    // Seed from config file
    const configPath = join(process.cwd(), "roster.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    entries =
      section === "mains"
        ? config.mains ?? config.characters ?? []
        : config.alts ?? [];
    await kv.set(key, entries);
  }
  return entries;
}

function requireAuth(req, res) {
  try {
    const sessionCookie = parse(req.headers.cookie || "").session;
    if (!sessionCookie) {
      res.status(401).json({ error: "Not authenticated" });
      return false;
    }
    jwt.verify(sessionCookie, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    return true;
  } catch {
    res.status(401).json({ error: "Invalid session" });
    return false;
  }
}

function requireJson(req, res) {
  const ct = req.headers["content-type"] ?? "";
  if (!ct.includes("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!requireAuth(req, res)) return;

  const method = req.method;

  if (method === "GET") {
    try {
      const [mainEntries, altEntries] = await Promise.all([
        getSection("mains"),
        getSection("alts"),
      ]);

      const [mainResults, altResults] = await Promise.all([
        Promise.allSettled(mainEntries.map(parseCharacter).map(enrichCharacter)),
        Promise.allSettled(altEntries.map(parseCharacter).map(enrichCharacter)),
      ]);

      res.status(200).json({
        mains: buildList(mainResults),
        alts: buildList(altResults),
      });
    } catch (err) {
      console.error("Roster GET error:", err);
      res.status(500).json({ error: "Internal error" });
    }
    return;
  }

  if (method === "POST") {
    if (!requireJson(req, res)) return;
    const { section, entry } = req.body ?? {};
    if (!["mains", "alts"].includes(section)) {
      return res.status(400).json({ error: "section must be 'mains' or 'alts'" });
    }
    if (!entry || entry === "---" || entry === "") {
      return res.status(400).json({ error: "entry must be a non-empty character string" });
    }
    try {
      const entries = await getSection(section);
      entries.push(entry);
      await kv.set(`roster:${section}`, entries);
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("Roster POST error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  }

  if (method === "DELETE") {
    if (!requireJson(req, res)) return;
    const { section, entry } = req.body ?? {};
    if (!["mains", "alts"].includes(section)) {
      return res.status(400).json({ error: "section must be 'mains' or 'alts'" });
    }
    if (!entry) {
      return res.status(400).json({ error: "entry is required" });
    }
    try {
      const entries = await getSection(section);
      const idx = entries.indexOf(entry);
      if (idx === -1) return res.status(404).json({ error: "Entry not found" });
      entries.splice(idx, 1);
      await kv.set(`roster:${section}`, entries);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Roster DELETE error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  }

  if (method === "PATCH") {
    if (!requireJson(req, res)) return;
    const { section, oldEntry, newEntry } = req.body ?? {};
    if (!["mains", "alts"].includes(section)) {
      return res.status(400).json({ error: "section must be 'mains' or 'alts'" });
    }
    if (!oldEntry || !newEntry || newEntry === "---" || newEntry === "") {
      return res.status(400).json({ error: "oldEntry and a valid newEntry are required" });
    }
    try {
      const entries = await getSection(section);
      const idx = entries.indexOf(oldEntry);
      if (idx === -1) return res.status(404).json({ error: "Entry not found" });
      entries[idx] = newEntry;
      await kv.set(`roster:${section}`, entries);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Roster PATCH error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
