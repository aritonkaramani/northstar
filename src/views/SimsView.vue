<template>
  <div class="sims-view">
    <div class="section-header">
      <div class="header-left">
        <h2>Sims</h2>
        <p class="subtitle">Raidbots droptimizer · loot priority matrix</p>
      </div>
      <button
        v-if="isAdmin"
        class="reset-btn"
        :disabled="resetting"
        @click="resetWeek"
      >
        {{ resetting ? "Resetting…" : "🗑 Reset Week" }}
      </button>
    </div>

    <!-- Difficulty tabs -->
    <div class="difficulty-tabs">
      <button
        v-for="d in difficulties"
        :key="d"
        :class="['diff-tab', { active: difficulty === d }]"
        @click="setDifficulty(d)"
      >
        {{ d.charAt(0).toUpperCase() + d.slice(1) }}
      </button>
    </div>

    <SimsUpload
      :difficulty="difficulty"
      :uploaders="uploaders"
      :expected="expected"
      @uploaded="onUploaded"
    />

    <div v-if="loading" class="state-msg">Loading sims…</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>
    <template v-else>
      <div class="view-tabs">
        <button
          :class="['view-tab', { active: view === 'items' }]"
          @click="view = 'items'"
        >
          Item View
        </button>
        <button
          :class="['view-tab', { active: view === 'players' }]"
          @click="view = 'players'"
        >
          Player View
        </button>
      </div>

      <div v-if="!result.players.length" class="state-msg">
        No sims uploaded yet for {{ difficulty }}. Upload your Raidbots
        droptimizer CSV above.
      </div>
      <template v-else>
        <SimsItemTable
          v-if="view === 'items'"
          :items="result.items"
          :players="result.players"
          :matrix="result.matrix"
        />
        <SimsPlayerCards
          v-else
          :items="result.items"
          :players="result.players"
          :matrix="result.matrix"
        />
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onMounted } from "vue";
import SimsUpload from "../components/SimsUpload.vue";
import SimsItemTable from "../components/SimsItemTable.vue";
import SimsPlayerCards from "../components/SimsPlayerCards.vue";

export default defineComponent({
  name: "SimsView",
  components: { SimsUpload, SimsItemTable, SimsPlayerCards },

  setup() {
    const difficulties = ["mythic", "heroic"] as const;
    type Difficulty = (typeof difficulties)[number];

    const difficulty = ref<Difficulty>("mythic");
    const view = ref<"items" | "players">("items");
    const loading = ref(true);
    const error = ref<string | null>(null);
    const resetting = ref(false);
    const isAdmin = ref(false);

    const result = ref<{ items: any[]; players: any[]; matrix: number[][] }>({
      items: [],
      players: [],
      matrix: [],
    });
    const uploaders = ref<any[]>([]);
    const expected = ref<string[]>([]);

    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) return;
        const { battleTag } = await res.json();
        const adminTag = import.meta.env.VITE_ADMIN_BATTLETAG ?? "";
        isAdmin.value = !!adminTag && battleTag === adminTag;
      } catch {
        /* non-fatal */
      }
    }

    async function fetchStatus() {
      try {
        const res = await fetch(
          `/api/sims-status?difficulty=${difficulty.value}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = await res.json();
        uploaders.value = data.uploaders ?? [];
        expected.value = data.expected ?? [];
      } catch {
        /* non-fatal */
      }
    }

    async function fetchResult() {
      loading.value = true;
      error.value = null;
      try {
        const res = await fetch(
          `/api/sims-result?difficulty=${difficulty.value}`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error(`Error ${res.status}`);
        result.value = await res.json();
      } catch (e: any) {
        error.value = e?.message ?? "Failed to load sims";
      } finally {
        loading.value = false;
      }
    }

    function setDifficulty(d: Difficulty) {
      difficulty.value = d;
    }

    async function onUploaded() {
      await Promise.all([fetchStatus(), fetchResult()]);
    }

    async function resetWeek() {
      if (
        !confirm(
          `Reset all ${difficulty.value} sims for this week? This cannot be undone.`,
        )
      )
        return;
      resetting.value = true;
      try {
        const res = await fetch(
          `/api/sims-reset?difficulty=${difficulty.value}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Reset failed");
        }
        await Promise.all([fetchStatus(), fetchResult()]);
      } catch (e: any) {
        alert(e?.message ?? "Reset failed");
      } finally {
        resetting.value = false;
      }
    }

    watch(difficulty, () => {
      fetchStatus();
      fetchResult();
    });

    onMounted(() => {
      fetchMe();
      fetchStatus();
      fetchResult();
    });

    return {
      difficulties,
      difficulty,
      view,
      loading,
      error,
      result,
      uploaders,
      expected,
      isAdmin,
      resetting,
      setDifficulty,
      onUploaded,
      resetWeek,
    };
  },
});
</script>

<style lang="scss" scoped>
.sims-view {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 1.2rem;
    margin-bottom: 1.4rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
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
    color: #6e7074;
    font-size: 0.78rem;
    letter-spacing: 0.5px;
  }

  .reset-btn {
    background: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.3);
    color: #dc3545;
    padding: 0.4rem 0.9rem;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
    &:hover:not(:disabled) {
      background: rgba(220, 53, 69, 0.2);
      border-color: rgba(220, 53, 69, 0.5);
    }
    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  .difficulty-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .diff-tab {
    padding: 0.4rem 1.2rem;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: transparent;
    color: #6e7074;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    transition:
      color 0.15s,
      background 0.15s,
      border-color 0.15s;
    &:hover {
      color: #b0b0b0;
      background: rgba(255, 255, 255, 0.04);
    }
    &.active {
      color: #c9a227;
      background: rgba(201, 162, 39, 0.08);
      border-color: rgba(201, 162, 39, 0.3);
    }
  }

  .view-tabs {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 1rem;
    margin-top: 1.5rem;
  }

  .view-tab {
    padding: 0.3rem 0.9rem;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: transparent;
    color: #6e7074;
    font-size: 0.8rem;
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
    &:hover {
      color: #b0b0b0;
    }
    &.active {
      color: #e8e8e8;
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.15);
    }
  }

  .state-msg {
    color: #555;
    padding: 60px 0;
    text-align: center;
    font-size: 0.9rem;
    letter-spacing: 1px;
    &.error {
      color: #c0392b;
    }
  }
}
</style>
