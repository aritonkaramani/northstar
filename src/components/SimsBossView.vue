<template>
  <div class="boss-view">
    <!-- Raid + Boss selectors -->
    <div class="boss-selectors">
      <select class="boss-select" v-model="selectedRaidId" @change="onRaidChange">
        <option v-for="raid in raids" :key="raid.id" :value="raid.id">
          {{ raid.name }}
        </option>
      </select>
      <select class="boss-select" v-model="selectedBossId">
        <option v-for="boss in currentRaid?.bosses ?? []" :key="boss.id" :value="boss.id">
          {{ boss.name }}
        </option>
      </select>
    </div>

    <!-- Boss item table -->
    <div v-if="!bossItems.length" class="state-msg">No items from this boss in the sim data.</div>
    <template v-else>
      <div class="item-table-wrap">
        <div class="table-scroll">
          <table class="item-table">
            <thead>
              <tr>
                <th class="col-item">Item</th>
                <th
                  v-for="player in players"
                  :key="player.name + player.spec"
                  class="col-player"
                >
                  <div class="player-header">
                    <span class="player-name">{{ capitalize(player.name) }}</span>
                    <span v-if="player.spec" class="player-spec">{{ player.spec }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in bossRows" :key="row.item.id">
                <td class="item-name">{{ row.item.name }}</td>
                <td
                  v-for="(gain, j) in row.gains"
                  :key="j"
                  class="gain-cell"
                  :style="gainStyle(gain, maxGain)"
                >
                  {{ gain > 0 ? gain.toLocaleString() : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed, watch, onMounted } from 'vue';

interface Player { name: string; spec: string | null }
interface Item   { id: number; name: string }
interface BossItem { id: number; name: string }
interface Boss   { id: number; name: string; icon: string; items: BossItem[] }
interface Raid   { id: number; name: string; bosses: Boss[] }

export default defineComponent({
  name: 'SimsBossView',
  props: {
    items:   { type: Array as PropType<Item[]>,          required: true },
    players: { type: Array as PropType<Player[]>,        required: true },
    matrix:  { type: Array as PropType<number[][]>,      required: true },
  },

  setup(props) {
    const raids = ref<Raid[]>([]);
    const selectedRaidId  = ref<number | null>(null);
    const selectedBossId  = ref<number | null>(null);

    async function fetchBosses() {
      try {
        const res = await fetch('/api/sims-bosses');
        if (!res.ok) return;
        raids.value = await res.json();
        if (raids.value.length) {
          selectedRaidId.value = raids.value[0].id;
          if (raids.value[0].bosses.length) {
            selectedBossId.value = raids.value[0].bosses[0].id;
          }
        }
      } catch { /* non-fatal */ }
    }

    onMounted(fetchBosses);

    const currentRaid = computed(() =>
      raids.value.find(r => r.id === selectedRaidId.value) ?? null
    );

    function onRaidChange() {
      const first = currentRaid.value?.bosses[0];
      selectedBossId.value = first?.id ?? null;
    }

    const currentBoss = computed(() =>
      currentRaid.value?.bosses.find(b => b.id === selectedBossId.value) ?? null
    );

    // Items that drop from the selected boss (from static data, not filtered by gains)
    const bossItems = computed(() => currentBoss.value?.items ?? []);

    const bossRows = computed(() => {
      if (!currentBoss.value) return [];
      // Use all items from the boss static data, not just ones with gains
      return currentBoss.value.items
        .map(bossItem => {
          const itemIdx = props.items.findIndex(i => i.id === bossItem.id);
          const gains = itemIdx === -1
            ? props.players.map(() => 0)
            : props.matrix[itemIdx];
          return { item: bossItem, gains, total: gains.reduce((s, g) => s + g, 0) };
        })
        .sort((a, b) => b.total - a.total);
    });

    const maxGain = computed(() => {
      let max = 0;
      for (const row of bossRows.value) for (const g of row.gains) if (g > max) max = g;
      return max || 1;
    });

    function gainStyle(gain: number, max: number) {
      if (!gain) return {};
      const alpha = 0.08 + (gain / max) * 0.55;
      return { background: `rgba(192, 132, 245, ${alpha})`, color: '#e8e8e8' };
    }

    function capitalize(s: string) {
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }

    return {
      raids, selectedRaidId, selectedBossId, currentRaid, currentBoss,
      bossItems, bossRows, maxGain, gainStyle, capitalize, onRaidChange,
      players: computed(() => props.players),
    };
  },
});
</script>

<style lang="scss" scoped>
.boss-view {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.boss-selectors {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.boss-select {
  background: #1f2023;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e8e8e8;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  cursor: pointer;
  min-width: 200px;

  &:focus { outline: none; border-color: rgba(192, 132, 245, 0.5); }

  option { background: #1f2023; }
}

.item-table-wrap {
  background: #1f2023;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  overflow: hidden;
}

.table-scroll { overflow-x: auto; }

.item-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;

  thead tr { background: #252629; }

  th {
    padding: 10px 14px;
    color: #6e7074;
    font-size: 0.67rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    white-space: nowrap;
    text-align: center;
    position: sticky;
    top: 0;
    background: #252629;
    z-index: 2;

    &.col-item {
      text-align: left;
      min-width: 220px;
      left: 0;
      z-index: 3;
    }
  }

  tbody tr {
    &:nth-child(even) { background: rgba(255, 255, 255, 0.015); }
    &:hover { background: rgba(255, 255, 255, 0.04); }
  }

  td {
    padding: 8px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    vertical-align: middle;
    text-align: center;
    color: #6e7074;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  tbody tr:last-child td { border-bottom: none; }
}

.col-player { min-width: 90px; }

.player-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.player-name { font-size: 0.72rem; color: #c4c4c4; font-weight: 600; }
.player-spec  { font-size: 0.62rem; color: #6e7074; text-transform: capitalize; }

.item-name {
  text-align: left !important;
  color: #b0b0b0;
  font-weight: 500;
  position: sticky;
  left: 0;
  background: inherit;
  z-index: 1;
}

.gain-cell {
  border-radius: 3px;
  font-size: 0.78rem;
  transition: background 0.1s;
}

.state-msg {
  color: #555;
  padding: 40px;
  text-align: center;
  font-size: 0.9rem;
}
</style>
