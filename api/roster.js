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

const VALID_ROLES = ["Tank", "Healer", "DPS"];
const VALID_CLASSES = Object.keys(CLASS_COLORS);

function isSafeKey(key) {
  return (
    typeof key === "string" && !/^(__proto__|constructor|prototype)$/.test(key)
  );
}

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
  if (dashIndex === -1)
    return { name: entry, realm: "ravencrest", _entry: entry };
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
        ? (config.mains ?? config.characters ?? [])
        : (config.alts ?? []);
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
    jwt.verify(sessionCookie, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
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
  const resource = req.query?.resource;

  // ── player-meta ──────────────────────────────────────────────────────────────
  if (resource === "player-meta") {
    if (method === "GET") {
      try {
        const meta = (await kv.get("roster:player-meta")) ?? {};
        return res.status(200).json(meta);
      } catch (err) {
        console.error("player-meta GET error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    if (method === "POST") {
      if (!requireJson(req, res)) return;
      const { class: cls, role } = req.body ?? {};
      const rawName = req.body?.name;
      const name = typeof rawName === "string" ? rawName.trim() : "";

      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }
      if (!isSafeKey(name)) {
        return res.status(400).json({ error: "Invalid player name" });
      }
      if (name.length > 100) {
        return res.status(400).json({ error: "name too long" });
      }
      if (cls === undefined || cls === null) {
        return res.status(400).json({ error: "class is required" });
      }
      if (!VALID_CLASSES.includes(cls)) {
        return res
          .status(400)
          .json({ error: `class must be one of: ${VALID_CLASSES.join(", ")}` });
      }
      if (role === undefined || role === null) {
        return res.status(400).json({ error: "role is required" });
      }
      if (!VALID_ROLES.includes(role)) {
        return res
          .status(400)
          .json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
      }
      const rawFlexRoles = req.body?.flexRoles;
      let flexRoles;
      if (Array.isArray(rawFlexRoles)) {
        const validFlexRoles = rawFlexRoles.filter(
          (r) => ["Tank", "Healer", "DPS"].includes(r) && r !== role,
        );
        flexRoles =
          validFlexRoles.length > 0 ? [...new Set(validFlexRoles)] : undefined;
      }
      const entry = { class: cls, role };
      if (flexRoles) entry.flexRoles = flexRoles;
      try {
        const meta = (await kv.get("roster:player-meta")) ?? {};
        meta[name] = entry;
        await kv.set("roster:player-meta", meta);
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("player-meta POST error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── raid-roster ───────────────────────────────────────────────────────────────
  if (resource === "raid-roster") {
    if (method === "GET") {
      try {
        const roster = (await kv.get("roster:raid-roster")) ?? {};
        return res.status(200).json(roster);
      } catch (err) {
        console.error("raid-roster GET error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    if (method === "POST") {
      if (!requireJson(req, res)) return;
      const body = req.body ?? {};

      // Bulk replace mode: body contains { roster: { [bossId]: [names] } }
      if (body.roster !== undefined) {
        if (
          body.roster === null ||
          typeof body.roster !== "object" ||
          Array.isArray(body.roster)
        ) {
          return res.status(400).json({ error: "roster must be an object" });
        }
        for (const [key, val] of Object.entries(body.roster)) {
          if (!isSafeKey(key)) {
            return res.status(400).json({ error: `Invalid boss ID: "${key}"` });
          }
          if (key.length > 20) {
            return res
              .status(400)
              .json({ error: `Boss ID too long: "${key}"` });
          }
          if (!Array.isArray(val) || val.some((v) => typeof v !== "string")) {
            return res
              .status(400)
              .json({ error: `roster["${key}"] must be an array of strings` });
          }
          if (val.some((v) => !isSafeKey(v))) {
            return res
              .status(400)
              .json({
                error: `roster["${key}"] contains invalid player names`,
              });
          }
          if (val.some((v) => v.length > 100)) {
            return res
              .status(400)
              .json({
                error: `roster["${key}"] contains a name that is too long`,
              });
          }
        }
        try {
          await kv.set("roster:raid-roster", body.roster);
          return res.status(200).json({ ok: true });
        } catch (err) {
          console.error("raid-roster POST (bulk) error:", err);
          return res.status(500).json({ error: "Internal error" });
        }
      }

      // Single toggle mode: body contains { bossId, name, checked }
      const { bossId, checked } = body;
      const name = typeof body.name === "string" ? body.name.trim() : body.name;
      if (!bossId || typeof bossId !== "string") {
        return res.status(400).json({ error: "bossId is required" });
      }
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "name is required" });
      }
      if (typeof checked !== "boolean") {
        return res.status(400).json({ error: "checked must be a boolean" });
      }
      if (!isSafeKey(bossId)) {
        return res.status(400).json({ error: "Invalid bossId" });
      }
      if (bossId.length > 20) {
        return res.status(400).json({ error: "bossId too long" });
      }
      if (name.length > 100) {
        return res.status(400).json({ error: "name too long" });
      }
      try {
        const raidRoster = (await kv.get("roster:raid-roster")) ?? {};
        const players = raidRoster[bossId] ?? [];
        if (checked) {
          if (!players.includes(name)) players.push(name);
        } else {
          const idx = players.indexOf(name);
          if (idx !== -1) players.splice(idx, 1);
        }
        raidRoster[bossId] = players;
        await kv.set("roster:raid-roster", raidRoster);
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("raid-roster POST (toggle) error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    if (method === "DELETE") {
      try {
        await kv.del("roster:raid-roster");
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("raid-roster DELETE error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── absent ────────────────────────────────────────────────────────────────────
  if (resource === "absent") {
    if (method === "GET") {
      try {
        const absent = (await kv.get("roster:absent")) ?? [];
        return res.status(200).json(absent);
      } catch (err) {
        console.error("absent GET error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    if (method === "POST") {
      if (!requireJson(req, res)) return;
      const rawName = req.body?.name;
      const name = typeof rawName === "string" ? rawName.trim() : "";
      const { absent: isAbsent } = req.body ?? {};
      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }
      if (!isSafeKey(name)) {
        return res.status(400).json({ error: "Invalid player name" });
      }
      if (name.length > 100) {
        return res.status(400).json({ error: "name too long" });
      }
      if (typeof isAbsent !== "boolean") {
        return res.status(400).json({ error: "absent must be a boolean" });
      }
      try {
        const list = (await kv.get("roster:absent")) ?? [];
        if (isAbsent) {
          if (!list.includes(name)) list.push(name);
        } else {
          const idx = list.indexOf(name);
          if (idx !== -1) list.splice(idx, 1);
        }
        await kv.set("roster:absent", list);
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("absent POST error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    if (method === "DELETE") {
      try {
        await kv.del("roster:absent");
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("absent DELETE error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── boss-config ───────────────────────────────────────────────────────────────
  if (resource === "boss-config") {
    if (method === "GET") {
      try {
        const config = (await kv.get("roster:boss-config")) ?? {};
        return res.status(200).json(config);
      } catch (err) {
        console.error("boss-config GET error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    if (method === "POST") {
      if (!requireJson(req, res)) return;
      const rawBossId = req.body?.bossId;
      const bossId = typeof rawBossId === "string" ? rawBossId.trim() : "";
      const { healers } = req.body ?? {};
      if (!bossId) {
        return res.status(400).json({ error: "bossId is required" });
      }
      if (!isSafeKey(bossId)) {
        return res.status(400).json({ error: "Invalid bossId" });
      }
      if (bossId.length > 20) {
        return res.status(400).json({ error: "bossId too long" });
      }
      if (!Number.isInteger(healers) || healers < 3 || healers > 5) {
        return res
          .status(400)
          .json({ error: "healers must be an integer 3–5" });
      }
      try {
        const config = (await kv.get("roster:boss-config")) ?? {};
        config[bossId] = { healers };
        await kv.set("roster:boss-config", config);
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("boss-config POST error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── boss-class-override ────────────────────────────────────────────────────────
  if (resource === "boss-class-override") {
    if (method === "GET") {
      try {
        const overrides = (await kv.get("roster:boss-class-override")) ?? {};
        return res.status(200).json(overrides);
      } catch (err) {
        console.error("boss-class-override GET error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }
    if (method === "POST") {
      const { bossId, name, className } = req.body ?? {};
      if (!isSafeKey(bossId))
        return res.status(400).json({ error: "Invalid bossId" });
      if (!isSafeKey(name))
        return res.status(400).json({ error: "Invalid name" });
      if (
        className !== null &&
        (typeof className !== "string" || className.length > 64)
      )
        return res.status(400).json({ error: "Invalid className" });
      try {
        const overrides = (await kv.get("roster:boss-class-override")) ?? {};
        if (!overrides[bossId]) overrides[bossId] = {};
        if (className === null) {
          delete overrides[bossId][name];
        } else {
          overrides[bossId][name] = className;
        }
        await kv.set("roster:boss-class-override", overrides);
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("boss-class-override POST error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── player-order ──────────────────────────────────────────────────────────────
  if (resource === "player-order") {
    if (method === "GET") {
      try {
        const order = (await kv.get("roster:player-order")) ?? {};
        return res.status(200).json(order);
      } catch (err) {
        console.error("player-order GET error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }
    if (method === "POST") {
      const { section, order } = req.body ?? {};
      if (!["mains", "alts"].includes(section))
        return res.status(400).json({ error: "Invalid section" });
      if (!Array.isArray(order) || order.some((n) => !isSafeKey(n)))
        return res.status(400).json({ error: "Invalid order" });
      try {
        const current = (await kv.get("roster:player-order")) ?? {};
        current[section] = order;
        await kv.set("roster:player-order", current);
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("player-order POST error:", err);
        return res.status(500).json({ error: "Internal error" });
      }
    }
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (method === "GET") {
    try {
      const [mainEntries, altEntries, playerOrder] = await Promise.all([
        getSection("mains"),
        getSection("alts"),
        kv.get("roster:player-order"),
      ]);

      const [mainResults, altResults] = await Promise.all([
        Promise.allSettled(
          mainEntries.map(parseCharacter).map(enrichCharacter),
        ),
        Promise.allSettled(altEntries.map(parseCharacter).map(enrichCharacter)),
      ]);

      function applyOrder(list, orderArr) {
        if (!orderArr || !orderArr.length) return list;
        const idx = Object.fromEntries(orderArr.map((n, i) => [n, i]));
        return [...list].sort((a, b) => {
          const ai = a.name != null ? (idx[a.name] ?? Infinity) : Infinity;
          const bi = b.name != null ? (idx[b.name] ?? Infinity) : Infinity;
          return ai - bi;
        });
      }

      res.status(200).json({
        mains: applyOrder(buildList(mainResults), playerOrder?.mains ?? null),
        alts: applyOrder(buildList(altResults), playerOrder?.alts ?? null),
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
      return res
        .status(400)
        .json({ error: "section must be 'mains' or 'alts'" });
    }
    if (!entry || entry === "---" || entry === "") {
      return res
        .status(400)
        .json({ error: "entry must be a non-empty character string" });
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
      return res
        .status(400)
        .json({ error: "section must be 'mains' or 'alts'" });
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
      return res
        .status(400)
        .json({ error: "section must be 'mains' or 'alts'" });
    }
    if (!oldEntry || !newEntry || newEntry === "---" || newEntry === "") {
      return res
        .status(400)
        .json({ error: "oldEntry and a valid newEntry are required" });
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
