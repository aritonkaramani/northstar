<template>
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
                <span class="player-spec">{{ player.spec }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in sortedRows" :key="row.id">
            <td class="item-name">{{ row.name }}</td>
            <td
              v-for="(gain, j) in row.gains"
              :key="j"
              class="gain-cell"
              :style="gainStyle(gain)"
              :title="gain > 0 ? `+${gain.toLocaleString()} DPS` : ''"
            >
              {{ gain > 0 ? gain.toLocaleString() : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="!sortedRows.length" class="empty-msg">No upgrades to display.</div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, computed } from 'vue';

interface Item   { id: number; name: string }
interface Player { name: string; spec: string }

export default defineComponent({
  name: 'SimsItemTable',

  props: {
    items:   { type: Array as PropType<Item[]>,     required: true },
    players: { type: Array as PropType<Player[]>,   required: true },
    matrix:  { type: Array as PropType<number[][]>, required: true },
  },

  setup(props) {
    const maxGain = computed(() => {
      let max = 0;
      for (const row of props.matrix) for (const v of row) if (v > max) max = v;
      return max || 1;
    });

    const sortedRows = computed(() =>
      props.items
        .map((item, i) => ({ ...item, gains: props.matrix[i] ?? [] }))
        .sort((a, b) => {
          const sumA = a.gains.reduce((s, v) => s + v, 0);
          const sumB = b.gains.reduce((s, v) => s + v, 0);
          return sumB - sumA;
        })
    );

    function gainStyle(gain: number) {
      if (!gain) return {};
      const intensity = Math.min(gain / maxGain.value, 1);
      const alpha = 0.08 + intensity * 0.55;
      return {
        background: `rgba(192, 132, 245, ${alpha.toFixed(2)})`,
        color: intensity > 0.5 ? '#e8e8e8' : '#b0b0b0',
        fontWeight: intensity > 0.6 ? '700' : '400',
      };
    }

    function capitalize(s: string) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }

    return { sortedRows, gainStyle, capitalize };
  },
});
</script>

<style lang="scss" scoped>
.item-table-wrap {
  background: #1f2023;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.item-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;

  thead tr {
    background: #252629;
    position: sticky;
    top: 0;
    z-index: 1;
  }

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

    &.col-item {
      text-align: left;
      min-width: 220px;
      position: sticky;
      left: 0;
      background: #252629;
      z-index: 2;
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
  align-items: center;
}

.player-name {
  color: #b0b0b0;
  font-weight: 600;
  font-size: 0.75rem;
}

.player-spec {
  color: #4e5057;
  font-size: 0.65rem;
}

.item-name {
  text-align: left !important;
  color: #b0b0b0;
  font-weight: 500;
  position: sticky;
  left: 0;
  background: inherit;
}

.gain-cell {
  border-radius: 3px;
  font-size: 0.78rem;
  transition: background 0.1s;
}

.empty-msg {
  color: #555;
  padding: 40px;
  text-align: center;
  font-size: 0.9rem;
}
</style>
