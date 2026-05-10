<template>
  <div class="player-cards">
    <div
      v-for="(player, j) in players"
      :key="player.name + player.spec"
      class="player-card"
    >
      <div class="card-header">
        <span class="card-name">{{ capitalize(player.name) }}</span>
        <span v-if="player.spec" class="card-spec">{{ player.spec }}</span>
      </div>
      <div class="card-body">
        <template v-if="topUpgrades(j).length">
          <div
            v-for="row in topUpgrades(j)"
            :key="row.id"
            class="upgrade-row"
          >
            <span class="upgrade-name">{{ row.name }}</span>
            <span class="upgrade-gain">+{{ row.gain.toLocaleString() }}</span>
          </div>
        </template>
        <div v-else class="no-upgrades">No upgrades simmed</div>
      </div>
    </div>
    <div v-if="!players.length" class="state-msg">No sims uploaded yet.</div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';

interface Item   { id: number; name: string }
interface Player { name: string; spec: string }

const MAX_UPGRADES = 10;

export default defineComponent({
  name: 'SimsPlayerCards',

  props: {
    items:   { type: Array as PropType<Item[]>,     required: true },
    players: { type: Array as PropType<Player[]>,   required: true },
    matrix:  { type: Array as PropType<number[][]>, required: true },
  },

  setup(props) {
    function topUpgrades(playerIndex: number) {
      return props.items
        .map((item, i) => ({ ...item, gain: props.matrix[i]?.[playerIndex] ?? 0 }))
        .filter(r => r.gain > 0)
        .sort((a, b) => b.gain - a.gain)
        .slice(0, MAX_UPGRADES);
    }

    function capitalize(s: string) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }

    return { topUpgrades, capitalize };
  },
});
</script>

<style lang="scss" scoped>
.player-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.player-card {
  flex: 1 1 260px;
  max-width: 340px;
  background: #1f2023;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  overflow: hidden;
}

.card-header {
  background: #252629;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.card-name {
  color: #e8e8e8;
  font-weight: 700;
  font-size: 0.9rem;
}

.card-spec {
  color: #6e7074;
  font-size: 0.72rem;
  text-transform: lowercase;
}

.card-body {
  padding: 0.6rem 0;
}

.upgrade-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 1rem;
  font-size: 0.8rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);

  &:last-child { border-bottom: none; }
  &:hover { background: rgba(255, 255, 255, 0.03); }
}

.upgrade-name {
  color: #b0b0b0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 0.8rem;
}

.upgrade-gain {
  color: #c084f5;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: 0.78rem;
  white-space: nowrap;
}

.no-upgrades {
  padding: 1rem;
  color: #4e5057;
  font-size: 0.8rem;
  text-align: center;
}

.state-msg {
  color: #555;
  font-size: 0.9rem;
  padding: 40px;
  text-align: center;
  width: 100%;
}
</style>
