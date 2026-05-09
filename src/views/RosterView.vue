<template>
  <div class="roster-view">
    <div class="section-header">
      <h2>Raid Roster</h2>
      <p class="subtitle">Main team · EU Ravencrest · Northstar · Managed via <code>roster.config.json</code></p>
    </div>

    <div v-if="loading" class="state-msg">Loading roster...</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>

    <template v-else>
      <div class="tables-row">
        <div class="table-col">
          <div class="table-label">Mains</div>
          <RosterTable :members="mains" />
        </div>

        <div v-if="alts.length" class="table-col">
          <div class="table-label">Alts</div>
          <RosterTable :members="alts" />
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import RosterTable from '../components/RosterTable.vue';

export default defineComponent({
  name: 'RosterView',
  components: { RosterTable },
  setup() {
    const mains = ref([]);
    const alts = ref([]);
    const loading = ref(true);
    const error = ref<string | null>(null);

    onMounted(async () => {
      try {
        const res = await fetch('/api/roster', { credentials: 'include' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        mains.value = data.mains ?? data; // fallback if old shape
        alts.value  = data.alts  ?? [];
      } catch (e: any) {
        error.value = e?.message ?? 'Failed to load roster';
      } finally {
        loading.value = false;
      }
    });

    return { mains, alts, loading, error };
  },
});
</script>

<style lang="scss" scoped>
.roster-view {
  .section-header {
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

    code {
      color: #c9a227;
      background: rgba(201, 162, 39, 0.1);
      border: 1px solid rgba(201, 162, 39, 0.2);
      border-radius: 3px;
      padding: 1px 5px;
      font-size: 0.75rem;
    }
  }

  .tables-row {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .table-col {
    flex: 1;
    min-width: 0;
  }

  .table-label {
    font-size: 0.67rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #6e7074;
    margin-bottom: 0.6rem;
  }

  .state-msg {
    color: #555;
    padding: 60px 0;
    text-align: center;
    font-size: 0.9rem;
    letter-spacing: 1px;

    &.error { color: #c0392b; }
  }
}
</style>
