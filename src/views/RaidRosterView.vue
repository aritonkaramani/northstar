<template>
  <div class="raid-roster-view">
    <div class="section-header">
      <div class="header-left">
        <h2>Roster</h2>
        <p class="subtitle">Raid assignment planner · Northstar</p>
      </div>
      <div v-if="isGM" class="header-actions">
        <span v-if="actionError" class="action-error">{{ actionError }}</span>
        <button
          class="action-btn action-btn--clear"
          @click="clearRoster"
          :disabled="saving"
        >
          Clear
        </button>
        <button
          class="action-btn action-btn--generate"
          @click="runGenerate"
          :disabled="saving"
        >
          {{ saving ? "Saving…" : "Generate" }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="state-msg">Loading roster…</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>

    <template v-else>
      <div class="table-wrapper">
        <table class="raid-table">
          <thead>
            <tr>
              <th class="col-player">Player</th>
              <th class="col-class">Class</th>
              <th class="col-role">Role</th>
              <th class="col-flex">Flex</th>
              <th class="col-out">Out</th>
              <th
                v-for="boss in BOSSES"
                :key="boss.id"
                class="col-boss"
                :title="bossFullName(boss.id)"
              >
                <div>{{ boss.name }}</div>
                <div class="boss-healer-config">
                  <input
                    type="number"
                    class="healer-input"
                    :value="bossConfig[boss.id]?.healers ?? 4"
                    min="3"
                    max="5"
                    @change="
                      updateBossHealers(
                        boss.id,
                        Number(($event.target as HTMLInputElement).value),
                      )
                    "
                  />
                  Healers
                </div>
              </th>
              <th class="col-count">Bosses</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="player in mains"
              :key="player"
              :class="{ 'row-absent': isAbsent(player) }"
            >
              <td
                class="col-player"
                :class="{ 'player-absent': isAbsent(player) }"
                :style="{
                  color: isAbsent(player) ? undefined : classColor(player),
                }"
              >
                {{ player }}
              </td>
              <td class="col-class">
                <select
                  class="meta-select"
                  :value="playerMeta[player]?.class ?? ''"
                  @change="
                    updateMeta(
                      player,
                      'class',
                      ($event.target as HTMLSelectElement).value,
                    )
                  "
                >
                  <option value="">—</option>
                  <option v-for="cls in WOW_CLASSES" :key="cls" :value="cls">
                    {{ cls }}
                  </option>
                </select>
              </td>
              <td class="col-role">
                <select
                  class="meta-select meta-select--role"
                  :value="playerMeta[player]?.role ?? ''"
                  @change="
                    updateMeta(
                      player,
                      'role',
                      ($event.target as HTMLSelectElement).value,
                    )
                  "
                >
                  <option value="">—</option>
                  <option value="Tank">Tank</option>
                  <option value="Healer">Healer</option>
                  <option value="DPS">DPS</option>
                </select>
              </td>
              <td class="col-flex">
                <template v-if="playerMeta[player]?.role">
                  <div class="flex-labels-group">
                    <label
                      v-for="flexRole in flexOptionsFor(player)"
                      :key="flexRole"
                      class="flex-label"
                    >
                      <input
                        type="checkbox"
                        :checked="
                          (playerMeta[player]?.flexRoles ?? []).includes(
                            flexRole,
                          )
                        "
                        @change="
                          updateFlex(
                            player,
                            flexRole,
                            ($event.target as HTMLInputElement).checked,
                          )
                        "
                      />
                      {{ flexRole }}
                    </label>
                  </div>
                </template>
                <template v-else>
                  <span class="flex-display">—</span>
                </template>
              </td>
              <td class="col-out">
                <input
                  type="checkbox"
                  :checked="isAbsent(player)"
                  @change="
                    toggleAbsent(
                      player,
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
              </td>
              <td v-for="boss in BOSSES" :key="boss.id" class="col-boss-cell">
                <div class="boss-cell">
                  <input
                    type="checkbox"
                    :checked="isAssigned(boss.id, player)"
                    @change="
                      toggleAssignment(
                        boss.id,
                        player,
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  <select
                    v-if="isAssigned(boss.id, player)"
                    class="boss-class-select"
                    :value="effectiveClass(boss.id, player)"
                    :style="{ color: effectiveClassColor(boss.id, player) }"
                    @change="
                      updateBossClass(
                        boss.id,
                        player,
                        ($event.target as HTMLSelectElement).value || null,
                      )
                    "
                  >
                    <option value="">
                      {{ playerMeta[player]?.class || "—" }}
                    </option>
                    <option v-for="cls in WOW_CLASSES" :key="cls" :value="cls">
                      {{ cls }}
                    </option>
                  </select>
                </div>
              </td>
              <td
                class="col-count"
                :class="{
                  'count-vault': playerBossCount(player) >= 6,
                  'count-low':
                    playerBossCount(player) > 0 && playerBossCount(player) < 6,
                }"
              >
                {{ playerBossCount(player) }}/{{ BOSSES.length }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" class="footer-label">Filled</td>
              <td
                v-for="boss in BOSSES"
                :key="boss.id"
                class="col-boss-cell footer-count"
                :class="{ full: bossCount(boss.id) === 20 }"
              >
                {{ bossCount(boss.id) }}/20
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from "vue";
import { useAuth } from "../composables/useAuth";
import { generateRoster } from "../utils/generateRoster";

interface RosterEntry {
  name?: string;
  separator?: boolean;
  empty?: boolean;
}

const BOSSES = [
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

type BossId = (typeof BOSSES)[number]["id"];

interface PlayerMeta {
  class: string;
  role: "Tank" | "Healer" | "DPS";
  flexRoles?: Array<"Tank" | "Healer" | "DPS">;
}

export default defineComponent({
  name: "RaidRosterView",
  setup() {
    const { user } = useAuth();
    const isGM = computed(() => user.value?.battleTag === "Ari#2764");

    const WOW_CLASSES = [
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

    const CLASS_COLORS: Record<string, string> = {
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

    function classColor(player: string): string {
      return CLASS_COLORS[playerMeta.value[player]?.class ?? ""] ?? "#8a8f98";
    }

    const mains = ref<string[]>([]);
    const playerMeta = ref<Record<string, PlayerMeta>>({});
    const raidRoster = ref<Record<string, string[]>>({});
    const loading = ref(true);
    const error = ref<string | null>(null);
    const actionError = ref<string | null>(null);
    const absent = ref<string[]>([]);
    const bossConfig = ref<Record<string, { healers: number }>>({});
    const bossClassOverrides = ref<Record<string, Record<string, string>>>({});

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
        ] = await Promise.all([
          fetch("/api/roster", { credentials: "include" }),
          fetch("/api/roster?resource=player-meta", { credentials: "include" }),
          fetch("/api/roster?resource=raid-roster", { credentials: "include" }),
          fetch("/api/roster?resource=absent", { credentials: "include" }),
          fetch("/api/roster?resource=boss-config", { credentials: "include" }),
          fetch("/api/roster?resource=boss-class-override", {
            credentials: "include",
          }),
        ]);
        if (!rosterRes.ok) throw new Error(`Roster ${rosterRes.status}`);
        const rosterData = await rosterRes.json();
        // Mains are enriched objects; extract plain names (skip separators/empty)
        mains.value = (rosterData.mains ?? [])
          .filter(
            (m: RosterEntry) =>
              !m.separator && !m.empty && typeof m.name === "string",
          )
          .map((m: RosterEntry) => m.name as string);

        if (metaRes.ok) {
          playerMeta.value = await metaRes.json();
        } else {
          console.warn(`player-meta fetch failed: ${metaRes.status}`);
        }

        if (raidRes.ok) {
          raidRoster.value = await raidRes.json();
        } else {
          console.warn(`raid-roster fetch failed: ${raidRes.status}`);
        }
        if (absentRes.ok) {
          absent.value = await absentRes.json();
        } else {
          console.warn(`absent fetch failed: ${absentRes.status}`);
        }
        if (bossConfigRes.ok) {
          bossConfig.value = await bossConfigRes.json();
        } else {
          console.warn(`boss-config fetch failed: ${bossConfigRes.status}`);
        }
        if (bossClassRes.ok) {
          bossClassOverrides.value = await bossClassRes.json();
        } else {
          console.warn(
            `boss-class-override fetch failed: ${bossClassRes.status}`,
          );
        }
      } catch (e) {
        error.value = e instanceof Error ? e.message : "Failed to load";
      } finally {
        loading.value = false;
      }
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

    async function toggleAssignment(
      bossId: string,
      player: string,
      checked: boolean,
    ) {
      // Snapshot for rollback
      const prev = [...(raidRoster.value[bossId] ?? [])];
      // Optimistic update (immutable replace — unambiguously reactive in Vue 3)
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
        // Rollback optimistic update
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
      // Only persist if both fields are set
      if (!updated.class || !updated.role) {
        // Update local state only (partial — don't persist yet)
        playerMeta.value[player] = updated as PlayerMeta;
        return;
      }
      playerMeta.value[player] = updated as PlayerMeta; // optimistic

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
        // Rollback optimistic update
        if (prev) {
          playerMeta.value[player] = prev;
        } else {
          delete (playerMeta.value as Record<string, PlayerMeta>)[player];
        }
        console.error(`updateMeta failed: ${res.status}`);
      }
    }

    const saving = ref(false);

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
        actionError.value = e instanceof Error ? e.message : "Generate failed";
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
        if (prev) {
          bossConfig.value[bossId] = prev;
        } else {
          delete (bossConfig.value as Record<string, { healers: number }>)[
            bossId
          ];
        }
        console.error(`updateBossHealers failed: ${res.status}`);
      }
    }

    const ROLES: Array<"Tank" | "Healer" | "DPS"> = ["Tank", "Healer", "DPS"];

    function flexOptionsFor(player: string): Array<"Tank" | "Healer" | "DPS"> {
      const primaryRole = playerMeta.value[player]?.role;
      return ROLES.filter((r) => r !== primaryRole);
    }

    function isAbsent(player: string): boolean {
      return absent.value.includes(player);
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
        body: JSON.stringify({
          bossId,
          name: player,
          className: className ?? null,
        }),
      });
      if (!res.ok) {
        bossClassOverrides.value[bossId] = prevOverrides;
        console.error(`updateBossClass failed: ${res.status}`);
      }
    }

    onMounted(fetchAll);

    return {
      BOSSES,
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
      isGM,
      WOW_CLASSES,
      classColor,
      ROLES,
      isAssigned,
      playerBossCount,
      bossCount,
      bossFullName,
      isAbsent,
      effectiveClass,
      effectiveClassColor,
      flexOptionsFor,
      toggleAssignment,
      updateMeta,
      toggleAbsent,
      updateFlex,
      updateBossHealers,
      updateBossClass,
      runGenerate,
      clearRoster,
    };
  },
});
</script>

<style lang="scss" scoped>
.raid-roster-view {
  .section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1.2rem;
    margin-bottom: 1.4rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
    align-items: center;
  }

  .action-error {
    color: #e05c5c;
    font-size: 0.75rem;
    align-self: center;
    background: rgba(224, 92, 92, 0.1);
    border: 1px solid rgba(224, 92, 92, 0.25);
    border-radius: 4px;
    padding: 3px 8px;
    max-width: 320px;
  }

  .action-btn {
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 7px 18px;
    cursor: pointer;
    border: 1px solid transparent;
    transition:
      background 0.15s,
      border-color 0.15s,
      opacity 0.15s;

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &--generate {
      background: rgba(201, 162, 39, 0.18);
      border-color: rgba(201, 162, 39, 0.4);
      color: #e0b830;
      &:not(:disabled):hover {
        background: rgba(201, 162, 39, 0.28);
        border-color: rgba(201, 162, 39, 0.65);
      }
    }

    &--clear {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.1);
      color: #6e7074;
      &:not(:disabled):hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.18);
        color: #aaa;
      }
    }
  }

  h2 {
    font-size: 1.4rem;
    color: #e8e8e8;
    font-weight: 900;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 0.3rem;
  }

  .subtitle {
    color: #555;
    font-size: 0.78rem;
    letter-spacing: 0.5px;
  }

  .state-msg {
    color: #555;
    padding: 60px 0;
    text-align: center;
    font-size: 0.9rem;
    letter-spacing: 1px;
    &.error {
      color: #e05c5c;
    }
  }

  .table-wrapper {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  }

  .raid-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
    color: #c8c8c8;

    // Sticky first columns
    .col-player,
    th.col-player {
      position: sticky;
      left: 0;
      z-index: 2;
    }
    .col-class,
    th.col-class {
      position: sticky;
      left: 130px;
      z-index: 2;
    }

    th,
    td {
      padding: 7px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      white-space: nowrap;
    }

    thead tr {
      background: #111215;
    }

    th {
      background: #111215;
      color: #555;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    // Separator between fixed info columns and boss columns
    th.col-boss:first-of-type,
    td.col-boss-cell:nth-child(6) {
      border-left: 1px solid rgba(255, 255, 255, 0.1);
    }

    .col-player {
      text-align: left;
      min-width: 130px;
      background: inherit;
      font-weight: 600;
    }
    .col-class {
      text-align: left;
      min-width: 118px;
      background: inherit;
    }
    .col-role {
      text-align: left;
      min-width: 72px;
    }
    .col-boss {
      min-width: 96px;
      text-align: center;
    }
    .col-boss-cell {
      text-align: center;
      vertical-align: middle;
      padding: 4px 6px;
    }

    .boss-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }

    .boss-class-select {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      font-size: 0.65rem;
      padding: 1px 2px;
      width: 72px;
      cursor: pointer;
      outline: none;
      text-align: center;
      font-weight: 600;
      &:focus {
        border-color: rgba(201, 162, 39, 0.4);
      }
      option {
        color: #c8c8c8;
        background: #1a1b1e;
      }
    }
    .col-count {
      text-align: center;
      min-width: 60px;
      color: #555;
      font-variant-numeric: tabular-nums;
    }
    .count-vault {
      color: #c9a227;
      font-weight: 700;
    }
    .count-low {
      color: #6e7074;
    }

    tbody tr {
      transition: background 0.1s;
      &:nth-child(even) {
        background: rgba(255, 255, 255, 0.018);
        td.col-player,
        td.col-class {
          background: #0e0f11;
        }
      }
      &:nth-child(odd) {
        td.col-player,
        td.col-class {
          background: #0a0a0c;
        }
      }
      &:hover {
        background: rgba(201, 162, 39, 0.05);
        td.col-player,
        td.col-class {
          background: #161408;
        }
      }
      &:last-child td {
        border-bottom: none;
      }
    }

    tfoot td {
      background: #111215;
      color: #555;
      font-size: 0.72rem;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      border-bottom: none;
    }

    .footer-label {
      text-align: left;
      color: #444;
    }
    .footer-count {
      color: #555;
      font-variant-numeric: tabular-nums;
    }
    .footer-count.full {
      color: #c9a227;
      font-weight: 700;
    }

    .row-absent {
      opacity: 0.35;
    }

    .player-absent {
      text-decoration: line-through;
      color: #555 !important;
    }

    .col-flex {
      text-align: left;
      min-width: 120px;
      vertical-align: middle;
    }

    .col-out {
      text-align: center;
      min-width: 44px;
    }

    .flex-labels-group {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .flex-label {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.73rem;
      color: #7a8090;
      cursor: pointer;
      white-space: nowrap;
      padding: 1px 0;

      input[type="checkbox"] {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
      }

      &:hover {
        color: #c8c8c8;
      }
    }

    .flex-display {
      font-size: 0.73rem;
      color: #5a5e6a;
    }

    .role-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 3px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;

      &--tank {
        background: rgba(59, 130, 246, 0.15);
        color: #6bb3f5;
        border: 1px solid rgba(59, 130, 246, 0.25);
      }
      &--healer {
        background: rgba(74, 222, 128, 0.12);
        color: #5dce8e;
        border: 1px solid rgba(74, 222, 128, 0.22);
      }
      &--dps {
        background: rgba(248, 113, 113, 0.12);
        color: #f07070;
        border: 1px solid rgba(248, 113, 113, 0.22);
      }
    }

    .boss-healer-config {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 0.65rem;
      color: #555;
      margin-top: 3px;
      white-space: nowrap;
    }

    .healer-input {
      width: 32px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      color: #c8c8c8;
      font-size: 0.68rem;
      padding: 1px 3px;
      text-align: center;
      &:focus {
        outline: none;
        border-color: rgba(201, 162, 39, 0.5);
      }
    }

    input[type="checkbox"] {
      cursor: pointer;
      accent-color: #c9a227;
      width: 15px;
      height: 15px;
    }

    .meta-select {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: #c8c8c8;
      font-size: 0.78rem;
      padding: 2px 4px;
      width: 100%;
      cursor: pointer;
      outline: none;
      &:focus {
        border-color: rgba(201, 162, 39, 0.5);
      }

      &--role {
        max-width: 70px;
      }
    }
  }
}
</style>
