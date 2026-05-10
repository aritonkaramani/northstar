<template>
  <div class="roster-view">
    <div class="section-header">
      <h2>Raid Roster</h2>
      <p class="subtitle">Main team · EU Ravencrest · Northstar</p>
    </div>

    <div v-if="loading" class="state-msg">Loading roster...</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>

    <template v-else>
      <div class="tables-row">
        <div class="table-col">
          <div class="table-label">Mains</div>
          <RosterTable
            :members="mains"
            :editable="true"
            @delete="(entry) => removePlayer('mains', entry)"
            @edit="({ oldEntry, newEntry }) => editPlayer('mains', oldEntry, newEntry)"
          />
          <div v-if="mainsError" class="action-error">{{ mainsError }}</div>
          <div class="add-player">
            <input
              v-model="mainsInput"
              class="add-input"
              placeholder="Name or Name-Realm"
              @keydown.enter="addPlayer('mains')"
            />
            <button class="add-btn" @click="addPlayer('mains')">+ Add</button>
          </div>
        </div>

        <div class="table-col">
          <div class="table-label">Alts</div>
          <RosterTable
            :members="alts"
            :editable="true"
            @delete="(entry) => removePlayer('alts', entry)"
            @edit="({ oldEntry, newEntry }) => editPlayer('alts', oldEntry, newEntry)"
          />
          <div v-if="altsError" class="action-error">{{ altsError }}</div>
          <div class="add-player">
            <input
              v-model="altsInput"
              class="add-input"
              placeholder="Name or Name-Realm"
              @keydown.enter="addPlayer('alts')"
            />
            <button class="add-btn" @click="addPlayer('alts')">+ Add</button>
          </div>
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
    const mains = ref<any[]>([]);
    const alts = ref<any[]>([]);
    const loading = ref(true);
    const error = ref<string | null>(null);
    const mainsError = ref<string | null>(null);
    const altsError = ref<string | null>(null);
    const mainsInput = ref('');
    const altsInput = ref('');

    async function fetchRoster() {
      try {
        const res = await fetch('/api/roster', { credentials: 'include' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        mains.value = data.mains ?? data;
        alts.value  = data.alts  ?? [];
      } catch (e: any) {
        error.value = e?.message ?? 'Failed to load roster';
      } finally {
        loading.value = false;
      }
    }

    async function addPlayer(section: 'mains' | 'alts') {
      const entry = section === 'mains' ? mainsInput.value.trim() : altsInput.value.trim();
      const errRef = section === 'mains' ? mainsError : altsError;
      errRef.value = null;
      if (!entry) return;
      try {
        const res = await fetch('/api/roster', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, entry }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          errRef.value = data.error ?? `Failed to add (${res.status})`;
          return;
        }
        if (section === 'mains') mainsInput.value = '';
        else altsInput.value = '';
        await fetchRoster();
      } catch (e: any) {
        errRef.value = e?.message ?? 'Network error';
      }
    }

    async function removePlayer(section: 'mains' | 'alts', entry: string) {
      const errRef = section === 'mains' ? mainsError : altsError;
      errRef.value = null;
      try {
        const res = await fetch('/api/roster', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, entry }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          errRef.value = data.error ?? `Failed to remove (${res.status})`;
          return;
        }
        await fetchRoster();
      } catch (e: any) {
        errRef.value = e?.message ?? 'Network error';
      }
    }

    async function editPlayer(section: 'mains' | 'alts', oldEntry: string, newEntry: string) {
      const errRef = section === 'mains' ? mainsError : altsError;
      errRef.value = null;
      try {
        const res = await fetch('/api/roster', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, oldEntry, newEntry }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          errRef.value = data.error ?? `Failed to edit (${res.status})`;
          return;
        }
        await fetchRoster();
      } catch (e: any) {
        errRef.value = e?.message ?? 'Network error';
      }
    }

    onMounted(fetchRoster);

    return {
      mains, alts, loading, error,
      mainsError, altsError,
      mainsInput, altsInput,
      addPlayer, removePlayer, editPlayer,
    };
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
  }

  .tables-row {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;

    @media (max-width: 768px) {
      flex-direction: column;
    }
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

  .action-error {
    color: #c0392b;
    font-size: 0.78rem;
    margin-top: 0.4rem;
    padding-left: 2px;
  }

  .add-player {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .add-input {
    flex: 1;
    background: #1f2023;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #e8e8e8;
    font-size: 0.85rem;
    padding: 6px 10px;
    outline: none;
    transition: border-color 0.15s;

    &::placeholder { color: #4a4d52; }
    &:focus { border-color: rgba(201, 162, 39, 0.5); }
  }

  .add-btn {
    background: rgba(201, 162, 39, 0.15);
    border: 1px solid rgba(201, 162, 39, 0.35);
    border-radius: 6px;
    color: #c9a227;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 6px 14px;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;

    &:hover {
      background: rgba(201, 162, 39, 0.25);
      border-color: rgba(201, 162, 39, 0.55);
    }
  }
}
</style>
