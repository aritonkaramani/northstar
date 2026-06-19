import { ref } from "vue";
import { generateRoster } from "../utils/generateRoster";
import {
  BOSSES,
  CLASS_COLORS,
  ROLES,
  type RosterEntry,
  type PlayerMeta,
} from "../constants/raidRoster";

export function useRaidRoster() {
  const mains = ref<string[]>([]);
  const playerMeta = ref<Record<string, PlayerMeta>>({});
  const raidRoster = ref<Record<string, string[]>>({});
  const loading = ref(true);
  const error = ref<string | null>(null);
  const actionError = ref<string | null>(null);
  const absent = ref<string[]>([]);
  const bossConfig = ref<Record<string, { healers: number }>>({});
  const bossClassOverrides = ref<Record<string, Record<string, string>>>({});
  const saving = ref(false);

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      const [
        rosterRes,
        metaRes,
        raidRes,
        absentRes,
        bossConfigRes,
        bossClassRes,
        absenceCalRes,
      ] = await Promise.all([
        fetch("/api/roster", { credentials: "include" }),
        fetch("/api/roster?resource=player-meta", { credentials: "include" }),
        fetch("/api/roster?resource=raid-roster", { credentials: "include" }),
        fetch("/api/roster?resource=absent", { credentials: "include" }),
        fetch("/api/roster?resource=boss-config", { credentials: "include" }),
        fetch("/api/roster?resource=boss-class-override", {
          credentials: "include",
        }),
        fetch("/api/absence", { credentials: "include" }),
      ]);
      if (!rosterRes.ok) throw new Error(`Roster ${rosterRes.status}`);
      const rosterData = await rosterRes.json();
      mains.value = (rosterData.mains ?? [])
        .filter(
          (m: RosterEntry) =>
            !m.separator && !m.empty && typeof m.name === "string",
        )
        .map((m: RosterEntry) => m.name as string);

      if (metaRes.ok) playerMeta.value = await metaRes.json();
      else console.warn(`player-meta fetch failed: ${metaRes.status}`);

      if (raidRes.ok) raidRoster.value = await raidRes.json();
      else console.warn(`raid-roster fetch failed: ${raidRes.status}`);

      let manualAbsent: string[] = [];
      if (absentRes.ok) manualAbsent = await absentRes.json();
      else console.warn(`absent fetch failed: ${absentRes.status}`);

      // Merge calendar absences for the next raid date
      let calendarAbsent: string[] = [];
      if (absenceCalRes.ok) {
        try {
          const calData = await absenceCalRes.json();
          const today = new Date().toISOString().slice(0, 10);
          const nextDate = (calData.dates ?? []).find((d: string) => d >= today);
          if (nextDate) {
            // attendance[date] stores absent members
            calendarAbsent = calData.attendance?.[nextDate] ?? [];
          }
        } catch { /* non-fatal */ }
      }

      // Union of manual + calendar absent, preserving order
      const merged = [...manualAbsent];
      for (const name of calendarAbsent) {
        if (!merged.includes(name)) merged.push(name);
      }
      absent.value = merged;

      if (bossConfigRes.ok) bossConfig.value = await bossConfigRes.json();
      else console.warn(`boss-config fetch failed: ${bossConfigRes.status}`);

      if (bossClassRes.ok)
        bossClassOverrides.value = await bossClassRes.json();
      else
        console.warn(
          `boss-class-override fetch failed: ${bossClassRes.status}`,
        );
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load";
    } finally {
      loading.value = false;
    }
  }

  // ── Derived helpers ───────────────────────────────────────────────────────

  function classColor(player: string): string {
    return CLASS_COLORS[playerMeta.value[player]?.class ?? ""] ?? "#8a8f98";
  }

  function isAssigned(bossId: string, player: string): boolean {
    return (raidRoster.value[bossId] ?? []).includes(player);
  }

  function playerBossCount(player: string): number {
    return BOSSES.filter((b) => isAssigned(b.id, player)).length;
  }

  function bossCount(bossId: string): number {
    return (raidRoster.value[bossId] ?? []).length;
  }

  function bossFullName(bossId: string): string {
    return BOSSES.find((b) => b.id === bossId)?.fullName ?? bossId;
  }

  function isAbsent(player: string): boolean {
    return absent.value.includes(player);
  }

  function flexOptionsFor(
    player: string,
  ): Array<"Tank" | "Healer" | "DPS"> {
    const primaryRole = playerMeta.value[player]?.role;
    return ROLES.filter((r) => r !== primaryRole);
  }

  function effectiveClass(bossId: string, player: string): string {
    return (
      bossClassOverrides.value[bossId]?.[player] ??
      playerMeta.value[player]?.class ??
      ""
    );
  }

  function effectiveClassColor(bossId: string, player: string): string {
    return CLASS_COLORS[effectiveClass(bossId, player)] ?? "#8a8f98";
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function toggleAssignment(
    bossId: string,
    player: string,
    checked: boolean,
  ) {
    const prev = [...(raidRoster.value[bossId] ?? [])];
    raidRoster.value[bossId] = checked
      ? [...prev, player]
      : prev.filter((p) => p !== player);
    const res = await fetch("/api/roster?resource=raid-roster", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bossId, name: player, checked }),
    });
    if (!res.ok) {
      raidRoster.value[bossId] = prev;
      console.error(`toggleAssignment failed: ${res.status}`);
    }
  }

  async function updateMeta(
    player: string,
    field: "class" | "role",
    value: string,
  ) {
    if (!value) return;
    const prev = playerMeta.value[player] ?? null;
    const updated = {
      class: "" as string,
      role: "" as string,
      ...(prev ?? {}),
      [field]: value,
    };
    if (!updated.class || !updated.role) {
      playerMeta.value[player] = updated as PlayerMeta;
      return;
    }
    playerMeta.value[player] = updated as PlayerMeta;
    const res = await fetch("/api/roster?resource=player-meta", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: player,
        class: updated.class,
        role: updated.role,
        flexRoles: (updated as PlayerMeta).flexRoles ?? [],
      }),
    });
    if (!res.ok) {
      if (prev) playerMeta.value[player] = prev;
      else delete (playerMeta.value as Record<string, PlayerMeta>)[player];
      console.error(`updateMeta failed: ${res.status}`);
    }
  }

  async function toggleAbsent(player: string, checked: boolean) {
    const prev = [...absent.value];
    absent.value = checked
      ? [...prev, player]
      : prev.filter((p) => p !== player);
    const res = await fetch("/api/roster?resource=absent", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: player, absent: checked }),
    });
    if (!res.ok) {
      absent.value = prev;
      console.error(`toggleAbsent failed: ${res.status}`);
    }
  }

  async function updateFlex(
    player: string,
    role: "Tank" | "Healer" | "DPS",
    checked: boolean,
  ) {
    const current = playerMeta.value[player];
    if (!current?.class || !current?.role) return;
    const prevFlex = current.flexRoles ?? [];
    const newFlex = checked
      ? [...prevFlex.filter((r) => r !== role), role]
      : prevFlex.filter((r) => r !== role);
    const prev = { ...current };
    playerMeta.value[player] = {
      ...current,
      flexRoles: newFlex.length > 0 ? newFlex : undefined,
    };
    const res = await fetch("/api/roster?resource=player-meta", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: player,
        class: current.class,
        role: current.role,
        flexRoles: newFlex,
      }),
    });
    if (!res.ok) {
      playerMeta.value[player] = prev;
      console.error(`updateFlex failed: ${res.status}`);
    }
  }

  async function updateBossHealers(bossId: string, healers: number) {
    const prev = bossConfig.value[bossId];
    bossConfig.value[bossId] = { healers };
    const res = await fetch("/api/roster?resource=boss-config", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bossId, healers }),
    });
    if (!res.ok) {
      if (prev) bossConfig.value[bossId] = prev;
      else
        delete (bossConfig.value as Record<string, { healers: number }>)[
          bossId
        ];
      console.error(`updateBossHealers failed: ${res.status}`);
    }
  }

  async function updateBossClass(
    bossId: string,
    player: string,
    className: string | null,
  ) {
    const prevOverrides = { ...(bossClassOverrides.value[bossId] ?? {}) };
    if (!bossClassOverrides.value[bossId])
      bossClassOverrides.value[bossId] = {};
    if (className === null || className === "") {
      delete bossClassOverrides.value[bossId][player];
    } else {
      bossClassOverrides.value[bossId][player] = className;
    }
    const res = await fetch("/api/roster?resource=boss-class-override", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bossId, name: player, className: className ?? null }),
    });
    if (!res.ok) {
      bossClassOverrides.value[bossId] = prevOverrides;
      console.error(`updateBossClass failed: ${res.status}`);
    }
  }

  async function runGenerate() {
    saving.value = true;
    actionError.value = null;
    const snapshot = { ...raidRoster.value };
    try {
      const result = generateRoster(
        mains.value,
        playerMeta.value,
        raidRoster.value,
        BOSSES.map((b) => ({ id: b.id, name: b.name })),
        absent.value,
        bossConfig.value,
      );
      raidRoster.value = result.grid;
      if (result.warnings.length > 0) {
        actionError.value = result.warnings.join(" · ");
      }
      const res = await fetch("/api/roster?resource=raid-roster", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster: result.grid }),
      });
      if (!res.ok) {
        raidRoster.value = snapshot;
        actionError.value = `Generate failed (${res.status})`;
      }
    } catch (e) {
      raidRoster.value = snapshot;
      actionError.value =
        e instanceof Error ? e.message : "Generate failed";
    } finally {
      saving.value = false;
    }
  }

  async function clearRoster() {
    saving.value = true;
    actionError.value = null;
    const snapshot = { ...raidRoster.value };
    try {
      raidRoster.value = {};
      const res = await fetch("/api/roster?resource=raid-roster", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        raidRoster.value = snapshot;
        actionError.value = `Clear failed (${res.status})`;
      }
    } catch (e) {
      raidRoster.value = snapshot;
      actionError.value = e instanceof Error ? e.message : "Clear failed";
    } finally {
      saving.value = false;
    }
  }

  return {
    // State
    mains,
    playerMeta,
    raidRoster,
    loading,
    error,
    actionError,
    absent,
    bossConfig,
    bossClassOverrides,
    saving,
    // Helpers
    classColor,
    isAssigned,
    playerBossCount,
    bossCount,
    bossFullName,
    isAbsent,
    flexOptionsFor,
    effectiveClass,
    effectiveClassColor,
    // Actions
    fetchAll,
    toggleAssignment,
    updateMeta,
    toggleAbsent,
    updateFlex,
    updateBossHealers,
    updateBossClass,
    runGenerate,
    clearRoster,
  };
}
