<template>
  <div class="cooldowns-view">
    <div class="section-header">
      <h2>Cooldowns</h2>
      <p class="subtitle" v-if="sheet">
        {{ sheet.encounterName }} · {{ sheet.difficulty }}
        <span class="saved-at" v-if="savedAt">· Updated {{ formattedSavedAt }}</span>
      </p>
    </div>

    <!-- Paste panel (any member can update) -->
    <details class="admin-panel">
      <summary>📋 Update Cooldowns</summary>
      <div class="admin-body">
        <textarea
          v-model="adminRaw"
          class="raw-input"
          rows="8"
          placeholder="Paste cooldown assignment block here…"
        />
        <div class="admin-actions">
          <button class="save-btn" :disabled="saving" @click="saveSheet">
            {{ saving ? "Saving…" : "Save" }}
          </button>
          <span v-if="saveStatus" :class="['save-status', saveStatusClass]">
            {{ saveStatus }}
          </span>
        </div>
      </div>
    </details>

    <!-- Loading state -->
    <div v-if="loading" class="state-msg">Loading cooldowns…</div>

    <template v-else>
      <!-- Boss selector -->
      <div class="player-row" v-if="encounterIndex.length">
        <label for="encounter-select" class="player-label">Boss:</label>
        <select id="encounter-select" v-model="selectedEncounterId" class="player-select" @change="onEncounterChange">
          <option :value="null">— select a boss —</option>
          <option v-for="enc in encounterIndex" :key="enc.encounterId" :value="enc.encounterId">
            {{ enc.name }} ({{ enc.difficulty }})
          </option>
        </select>
      </div>

      <!-- No encounters saved yet -->
      <div v-if="!encounterIndex.length" class="state-msg">No cooldown sheets saved yet.</div>

      <!-- Sheet not selected or not loaded -->
      <div v-else-if="!sheet" class="state-msg">
        {{ selectedEncounterId ? 'Loading…' : 'Select a boss above.' }}
      </div>

      <template v-else>
        <!-- Player selector -->
        <div class="player-row">
          <label for="player-select" class="player-label">View assignments for:</label>
          <select id="player-select" v-model="selectedPlayer" class="player-select">
            <option value="">— select a player —</option>
            <option v-for="name in playerNames" :key="name" :value="name">
              {{ rosterMap.get(name.toLowerCase()) || name }}{{ isAbsent(name) ? ' ⚠ absent' : '' }}
            </option>
          </select>
        </div>

        <!-- Absence notice -->
        <div v-if="selectedPlayer && isAbsent(selectedPlayer)" class="absence-notice">
          ⚠ {{ rosterMap.get(selectedPlayer.toLowerCase()) || selectedPlayer }} is marked absent
          <template v-if="nextRaidDate"> for {{ nextRaidDate }}</template>
        </div>

        <!-- Entries -->
        <template v-if="selectedPlayer">
          <!-- Personal entries grouped by phase -->
          <template v-for="phase in phasesForPlayer" :key="phase">
            <div class="phase-header">Phase {{ phase }}</div>
            <table class="entries-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Spell</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entry, i) in entriesByPhase.get(phase)" :key="i">
                  <td class="time-cell">{{ formatTime(entry.time) }}</td>
                  <td class="spell-cell">
                    <template v-if="entry.spellId">
                      <img
                        v-if="spellIcons.get(entry.spellId)"
                        :src="`https://wow.zamimg.com/images/wow/icons/small/${spellIcons.get(entry.spellId)}.jpg`"
                        :alt="String(entry.spellId)"
                        class="spell-icon"
                      />
                      <span>{{ spellNames.get(entry.spellId) || entry.spellId }}</span>
                    </template>
                    <span v-if="entry.text" class="text-label">{{ entry.text }}</span>
                    <span v-if="!entry.spellId && !entry.text" class="dim">—</span>
                    <span v-if="entry.bossSpell" class="badge badge--boss">
                      {{ spellNames.get(entry.bossSpell) || `Boss ${entry.bossSpell}` }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- Raid-wide "everyone" entries -->
          <template v-if="everyoneEntries.length">
            <div class="phase-header phase-header--raidwide">Raid-wide</div>
            <table class="entries-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Time</th>
                  <th>Spell</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entry, i) in everyoneEntries" :key="i">
                  <td><span class="badge badge--phase">P{{ entry.phase }}</span></td>
                  <td class="time-cell">{{ formatTime(entry.time) }}</td>
                  <td class="spell-cell">
                    <template v-if="entry.spellId">
                      <img
                        v-if="spellIcons.get(entry.spellId)"
                        :src="`https://wow.zamimg.com/images/wow/icons/small/${spellIcons.get(entry.spellId)}.jpg`"
                        :alt="String(entry.spellId)"
                        class="spell-icon"
                      />
                      <span>{{ spellNames.get(entry.spellId) || entry.spellId }}</span>
                    </template>
                    <span v-if="entry.text" class="text-label">{{ entry.text }}</span>
                    <span v-if="!entry.spellId && !entry.text" class="dim">—</span>
                    <span v-if="entry.bossSpell" class="badge badge--boss">
                      {{ spellNames.get(entry.bossSpell) || `Boss ${entry.bossSpell}` }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- Export button -->
          <div class="export-row">
            <button class="export-btn" @click="exportNote">📋 Copy my note</button>
            <span v-if="copyStatus" class="copy-status">{{ copyStatus }}</span>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from "vue";
import {
  parseCooldowns,
  type CooldownSheet,
  type CooldownEntry,
} from "../utils/parseCooldowns";

interface EncounterIndexEntry {
  encounterId: number;
  name: string;
  difficulty: string;
  savedAt: string;
}

export default defineComponent({
  name: "CooldownsView",
  setup() {
    const encounterIndex = ref<EncounterIndexEntry[]>([]);
    const selectedEncounterId = ref<number | null>(null);
    const sheet = ref<CooldownSheet | null>(null);
    const savedAt = ref<string | null>(null);
    const loading = ref(true);
    const selectedPlayer = ref("");
    const adminRaw = ref("");
    const saving = ref(false);
    const saveStatus = ref("");
    const saveStatusClass = ref<"" | "success" | "error">("");
    const spellIcons = ref<Map<number, string>>(new Map());
    const spellNames = ref<Map<number, string>>(new Map());
    const copyStatus = ref("");

    // ── Roster + absence ──────────────────────────────────────────────────────

    const rosterMembers = ref<string[]>([]);
    const raidDates = ref<string[]>([]);
    const attendance = ref<Record<string, string[]>>({});

    // Strip realm suffix: "Karcywave-TarrenMill" → "karcywave"
    function baseName(name: string) {
      return name.split("-")[0].toLowerCase();
    }

    // Map from cooldown tag (lowercase) → full roster name
    const rosterMap = computed(() => {
      const map = new Map<string, string>();
      for (const m of rosterMembers.value) {
        if (m === "---" || m === "") continue;
        map.set(baseName(m), m);
      }
      return map;
    });

    // Set of lowercase base names absent for the nearest upcoming raid date
    const absentSet = computed(() => {
      const set = new Set<string>();
      if (!raidDates.value.length) return set;
      const today = new Date().toISOString().slice(0, 10);
      const nextDate = raidDates.value.find((d) => d >= today) ?? raidDates.value[0];
      for (const entry of attendance.value[nextDate] ?? []) {
        set.add(baseName(entry));
      }
      return set;
    });

    const nextRaidDate = computed(() => {
      const today = new Date().toISOString().slice(0, 10);
      return raidDates.value.find((d) => d >= today) ?? null;
    });

    function isAbsent(tag: string) {
      return absentSet.value.has(tag.toLowerCase());
    }

    async function fetchAbsence() {
      try {
        const res = await fetch("/api/absence", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        rosterMembers.value = data.members ?? [];
        raidDates.value = data.dates ?? [];
        attendance.value = data.attendance ?? {};
      } catch { /* non-fatal */ }
    }

    // ── Spell icon + name fetching ────────────────────────────────────────────

    async function fetchSpellIcons(spellIds: number[]) {
      const toFetch = spellIds.filter((id) => !spellIcons.value.has(id));
      if (!toFetch.length) return;
      await Promise.allSettled(
        toFetch.map(async (id) => {
          try {
            const res = await fetch(
              `https://nether.wowhead.com/tooltip/spell/${id}?locale=enus`
            );
            if (!res.ok) return;
            const data = await res.json();
            if (data?.icon) {
              const updatedIcons = new Map(spellIcons.value);
              updatedIcons.set(id, data.icon);
              spellIcons.value = updatedIcons;
            }
            if (data?.name) {
              const updatedNames = new Map(spellNames.value);
              updatedNames.set(id, data.name);
              spellNames.value = updatedNames;
            }
          } catch { /* non-fatal — icon/name just won't show */ }
        })
      );
    }

    // ── Data fetching ─────────────────────────────────────────────────────────

    async function fetchIndex() {
      try {
        const res = await fetch("/api/cooldowns", { credentials: "include" });
        if (!res.ok) return;
        encounterIndex.value = await res.json();
        // Auto-select first encounter if only one exists
        if (encounterIndex.value.length === 1) {
          selectedEncounterId.value = encounterIndex.value[0].encounterId;
          await fetchSheet(selectedEncounterId.value);
        }
      } catch { /* non-fatal */ } finally {
        loading.value = false;
      }
    }

    async function fetchSheet(encounterId: number) {
      selectedPlayer.value = "";
      sheet.value = null;
      try {
        const res = await fetch(`/api/cooldowns?id=${encounterId}`, { credentials: "include" });
        if (!res.ok) return;
        const data: { raw: string; savedAt: string } = await res.json();
        savedAt.value = data.savedAt;
        adminRaw.value = data.raw;
        const parsed = parseCooldowns(data.raw);
        sheet.value = parsed;
        if (parsed) {
          const playerIds = parsed.entries.map((e) => e.spellId).filter((id): id is number => id !== undefined);
          const bossIds = parsed.entries.map((e) => e.bossSpell).filter((id): id is number => id !== undefined);
          const allIds = [...new Set([...playerIds, ...bossIds])];
          fetchSpellIcons(allIds); // fire-and-forget; icons + names load in as they arrive
        }
      } catch { /* non-fatal */ }
    }

    async function onEncounterChange() {
      if (selectedEncounterId.value !== null) {
        await fetchSheet(selectedEncounterId.value);
      } else {
        sheet.value = null;
        adminRaw.value = "";
      }
    }

    onMounted(() => {
      fetchIndex();
      fetchAbsence();
    });

    // ── Save ──────────────────────────────────────────────────────────────────

    async function saveSheet() {
      if (!adminRaw.value.trim()) return;
      saving.value = true;
      saveStatus.value = "";
      try {
        const res = await fetch("/api/cooldowns", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: adminRaw.value }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
          saveStatus.value = `Error: ${error}`;
          saveStatusClass.value = "error";
        } else {
          const { encounterId } = await res.json();
          saveStatus.value = "Saved!";
          saveStatusClass.value = "success";
          setTimeout(() => { saveStatus.value = ""; saveStatusClass.value = ""; }, 3000);
          // Refresh index, then load the saved encounter
          await fetchIndex();
          selectedEncounterId.value = encounterId;
          await fetchSheet(encounterId);
        }
      } catch {
        saveStatus.value = "Network error";
        saveStatusClass.value = "error";
      } finally {
        saving.value = false;
      }
    }

    // ── Derived data ──────────────────────────────────────────────────────────

    const playerNames = computed(() => {
      if (!sheet.value) return [];
      const names = new Set<string>();
      for (const e of sheet.value.entries) {
        if (e.tag !== "everyone") names.add(e.tag);
      }
      return [...names].sort((a, b) => a.localeCompare(b));
    });

    const phasesForPlayer = computed(() => {
      if (!sheet.value || !selectedPlayer.value) return [];
      const phases = new Set<number>();
      for (const e of sheet.value.entries) {
        if (e.tag === selectedPlayer.value) phases.add(e.phase);
      }
      return [...phases].sort((a, b) => a - b);
    });

    const entriesByPhase = computed(() => {
      const map = new Map<number, CooldownEntry[]>();
      if (!sheet.value || !selectedPlayer.value) return map;
      for (const e of sheet.value.entries) {
        if (e.tag !== selectedPlayer.value) continue;
        const bucket = map.get(e.phase) ?? [];
        bucket.push(e);
        map.set(e.phase, bucket);
      }
      map.forEach((arr) => arr.sort((a, b) => a.time - b.time));
      return map;
    });

    const everyoneEntries = computed((): CooldownEntry[] => {
      if (!sheet.value) return [];
      return sheet.value.entries
        .filter((e) => e.tag === "everyone")
        .sort((a, b) => a.phase !== b.phase ? a.phase - b.phase : a.time - b.time);
    });

    function formatTime(seconds: number): string {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    const formattedSavedAt = computed(() => {
      if (!savedAt.value) return "";
      return new Date(savedAt.value).toLocaleString();
    });

    // ── Export ────────────────────────────────────────────────────────────────

    function spellLabel(entry: CooldownEntry): string {
      if (entry.text) return entry.text;
      if (entry.spellId) {
        const name = spellNames.value.get(entry.spellId);
        return name ? `${name} (${entry.spellId})` : String(entry.spellId);
      }
      return "—";
    }

    async function exportNote() {
      if (!sheet.value || !selectedPlayer.value) return;
      const lines: string[] = [
        `${sheet.value.encounterName} (${sheet.value.difficulty}) — ${selectedPlayer.value}`,
        "",
      ];
      for (const phase of phasesForPlayer.value) {
        lines.push(`Phase ${phase}:`);
        for (const e of entriesByPhase.value.get(phase) ?? []) {
          const boss = e.bossSpell ? ` [boss ability]` : "";
          lines.push(`  ${formatTime(e.time)} — ${spellLabel(e)}${boss}`);
        }
        lines.push("");
      }
      if (everyoneEntries.value.length) {
        lines.push("Raid-wide:");
        for (const e of everyoneEntries.value) {
          lines.push(`  P${e.phase} ${formatTime(e.time)} — ${spellLabel(e)}`);
        }
      }
      try {
        await navigator.clipboard.writeText(lines.join("\n").trimEnd());
        copyStatus.value = "Copied!";
        setTimeout(() => { copyStatus.value = ""; }, 2500);
      } catch {
        copyStatus.value = "Copy failed";
        setTimeout(() => { copyStatus.value = ""; }, 2500);
      }
    }

    return {
      encounterIndex, selectedEncounterId, onEncounterChange,
      sheet, savedAt, formattedSavedAt,
      loading, selectedPlayer,
      adminRaw, saving, saveStatus, saveStatusClass,
      playerNames, phasesForPlayer, entriesByPhase,
      everyoneEntries, formatTime, saveSheet,
      spellIcons, spellNames,
      exportNote, copyStatus,
      rosterMap, isAbsent, nextRaidDate,
    };
  },
});
</script>

<style lang="scss" scoped>
.cooldowns-view {
  .section-header {
    padding-bottom: 1.2rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);

    h2 {
      font-size: 1.4rem;
      color: #e8e8e8;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-bottom: 0.3rem;
    }

    .subtitle {
      font-size: 0.82rem;
      color: #666;
      margin: 0;
    }

    .saved-at {
      color: #444;
    }
  }

  .admin-panel {
    margin-bottom: 1.5rem;
    border: 1px solid rgba(201, 162, 39, 0.2);
    border-radius: 8px;
    background: rgba(201, 162, 39, 0.04);

    summary {
      padding: 0.75rem 1rem;
      cursor: pointer;
      font-size: 0.85rem;
      color: #c9a227;
      user-select: none;
    }

    .admin-body {
      padding: 0 1rem 1rem;
    }

    .raw-input {
      width: 100%;
      background: #111;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: #ccc;
      font-family: monospace;
      font-size: 0.78rem;
      padding: 0.6rem;
      resize: vertical;
      box-sizing: border-box;
    }

    .admin-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.6rem;
    }

    .save-btn {
      background: rgba(201, 162, 39, 0.15);
      border: 1px solid rgba(201, 162, 39, 0.35);
      border-radius: 6px;
      color: #c9a227;
      cursor: pointer;
      font-size: 0.82rem;
      padding: 0.4rem 1rem;
      transition: background 0.15s;

      &:hover:not(:disabled) {
        background: rgba(201, 162, 39, 0.25);
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .save-status {
      font-size: 0.8rem;
      &.success {
        color: #5fba7d;
      }
      &.error {
        color: #e05c5c;
      }
    }
  }

  .state-msg {
    color: #444;
    font-size: 0.85rem;
    margin-top: 1.5rem;
  }

  .player-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .player-label {
    font-size: 0.82rem;
    color: #888;
  }

  .player-select {
    background: #1e1f23;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 0.85rem;
    padding: 0.35rem 0.7rem;
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: rgba(201, 162, 39, 0.4);
    }
  }

  .phase-header {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #555;
    margin: 1.2rem 0 0.4rem;

    &--raidwide {
      color: #c9a227;
      border-top: 1px solid rgba(201, 162, 39, 0.1);
      padding-top: 1rem;
      margin-top: 1.5rem;
    }
  }

  .entries-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;

    th {
      text-align: left;
      color: #444;
      font-weight: 600;
      font-size: 0.7rem;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 0.25rem 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    td {
      padding: 0.35rem 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      color: #ccc;

      &.time-cell { font-family: monospace; color: #8af; width: 5rem; }
      &.spell-cell { color: #e0e0e0; }
    }

    tr:last-child td {
      border-bottom: none;
    }
  }

  .absence-notice {
    font-size: 0.82rem;
    color: #e0a020;
    background: rgba(224, 160, 32, 0.08);
    border: 1px solid rgba(224, 160, 32, 0.2);
    border-radius: 6px;
    padding: 0.45rem 0.8rem;
    margin-bottom: 1.2rem;
  }

  .export-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .export-btn {
    background: rgba(95, 186, 125, 0.1);
    border: 1px solid rgba(95, 186, 125, 0.3);
    border-radius: 6px;
    color: #5fba7d;
    cursor: pointer;
    font-size: 0.82rem;
    padding: 0.4rem 1rem;
    transition: background 0.15s;

    &:hover {
      background: rgba(95, 186, 125, 0.2);
    }
  }

  .copy-status {
    font-size: 0.8rem;
    color: #5fba7d;
  }

  .text-label {
    color: #c9a227;
    font-style: italic;
  }
  .dim { color: #333; }

  .spell-icon {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    vertical-align: middle;
    margin-right: 0.35rem;
    image-rendering: pixelated;
  }

  .badge {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    border-radius: 4px;
    padding: 0.1rem 0.45rem;
    letter-spacing: 0.5px;

    &--boss {
      background: rgba(224, 92, 92, 0.15);
      border: 1px solid rgba(224, 92, 92, 0.3);
      color: #e05c5c;
      margin-left: 0.5rem;
    }

    &--phase {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #888;
    }
  }
}
</style>
