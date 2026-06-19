export const BOSSES = [
  { id: "2795", name: "Chimaerus", fullName: "Chimaerus the Undreamt God" },
  { id: "2733", name: "Imperator", fullName: "Imperator Averzian" },
  { id: "2734", name: "Vorasius", fullName: "Vorasius" },
  { id: "2736", name: "Fallen-King", fullName: "Fallen-King Salhadaar" },
  { id: "2735", name: "Vaelgor", fullName: "Vaelgor & Ezzorak" },
  { id: "2737", name: "Vanguard", fullName: "Lightblinded Vanguard" },
  { id: "2738", name: "Crown", fullName: "Crown of the Cosmos" },
  { id: "2739", name: "Belo'ren", fullName: "Belo'ren, Child of Al'ar" },
  { id: "2740", name: "Midnight", fullName: "Midnight Falls" },
] as const;

export type BossId = (typeof BOSSES)[number]["id"];

export const WOW_CLASSES = [
  "Death Knight",
  "Demon Hunter",
  "Druid",
  "Evoker",
  "Hunter",
  "Mage",
  "Monk",
  "Paladin",
  "Priest",
  "Rogue",
  "Shaman",
  "Warlock",
  "Warrior",
] as const;

export const CLASS_COLORS: Record<string, string> = {
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

export const ROLES: Array<"Tank" | "Healer" | "DPS"> = [
  "Tank",
  "Healer",
  "DPS",
];

export interface RosterEntry {
  name?: string;
  separator?: boolean;
  empty?: boolean;
}

export interface PlayerMeta {
  class: string;
  role: "Tank" | "Healer" | "DPS";
  flexRoles?: Array<"Tank" | "Healer" | "DPS">;
}
