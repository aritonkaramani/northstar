import { parse } from "cookie";
import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { join } from "path";

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
  if (dashIndex === -1) return { name: entry, realm: "ravencrest" };
  return {
    name: entry.slice(0, dashIndex),
    realm: toRealmSlug(entry.slice(dashIndex + 1)),
  };
}

async function enrichCharacter(char) {
  if (char.separator) return { separator: true };
  if (char.empty) return { empty: true };

  const { name, realm } = char;
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

export default async function handler(req, res) {
  // Auth check
  try {
    const sessionCookie = parse(req.headers.cookie || "").session;
    if (!sessionCookie)
      return res.status(401).json({ error: "Not authenticated" });
    jwt.verify(sessionCookie, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }

  try {
    const configPath = join(process.cwd(), "roster.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));

    // Support legacy "characters" key or new "mains"/"alts" split
    const mainEntries = (config.mains ?? config.characters ?? []).map(
      parseCharacter,
    );
    const altEntries = (config.alts ?? []).map(parseCharacter);

    const [mainResults, altResults] = await Promise.all([
      Promise.allSettled(mainEntries.map(enrichCharacter)),
      Promise.allSettled(altEntries.map(enrichCharacter)),
    ]);

    const toMembers = (results) => buildList(results);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      mains: toMembers(mainResults),
      alts: toMembers(altResults),
    });
  } catch (err) {
    console.error("Roster error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
