<template>
  <div class="roster-wrap">
    <table class="roster-table">
      <thead>
        <tr>
          <th class="col-name">Name</th>
          <th class="col-num">iLvl</th>
          <th class="col-num">Keys</th>
          <th class="col-num">Best</th>
          <th class="col-vault">Vault</th>
          <th v-if="editable" class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(m, i) in members" :key="i">
          <tr v-if="m.separator" class="separator-row">
            <td :colspan="editable ? 6 : 5" />
          </tr>
          <tr v-else-if="m.empty" class="empty-row">
            <td :colspan="editable ? 6 : 5" />
          </tr>
          <tr v-else>
            <td class="char-name">
              <template v-if="editable && editingIndex === i">
                <input
                  v-model="editValue"
                  class="edit-input"
                  @keydown.enter="saveEdit(m, i)"
                  @keydown.esc="cancelEdit"
                />
              </template>
              <template v-else>
                <a
                  v-if="m.name && m.realm"
                  :href="`https://raider.io/characters/eu/${m.realm}/${m.name}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="char-link"
                  :style="{ color: m.classColor }"
                >{{ m.name }}</a>
                <span v-else class="char-label" :style="{ color: m.classColor }">{{ m.name }}</span>
              </template>
            </td>
            <td class="ilvl">{{ m.itemLevel || '—' }}</td>
            <td class="keys">{{ m.keysThisWeek }}</td>
            <td class="highest">{{ m.highestKey ? '+' + m.highestKey : '—' }}</td>
            <td class="vault-slots">
              <span
                v-for="(slot, si) in m.vaultSlots"
                :key="si"
                :class="['vault-slot', slot ? 'vault-slot--unlocked' : 'vault-slot--locked']"
              >{{ slot ? '+' + slot : '—' }}</span>
            </td>
            <td v-if="editable" class="actions-cell">
              <template v-if="editingIndex === i">
                <button class="action-btn" title="Save" @click="saveEdit(m, i)">✓</button>
                <button class="action-btn" title="Cancel" @click="cancelEdit">✕</button>
              </template>
              <template v-else>
                <button class="action-btn" title="Edit" @click="startEdit(m, i)">✏</button>
                <button class="action-btn action-btn--delete" title="Delete" @click="$emit('delete', m._entry)">🗑</button>
              </template>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref } from 'vue';

interface RosterMember {
  separator?: boolean;
  empty?: boolean;
  name?: string;
  realm?: string;
  className?: string | null;
  classColor?: string;
  itemLevel?: number;
  keysThisWeek?: number;
  highestKey?: number;
  vaultSlots?: (number | null)[];
  _entry?: string;
}

export default defineComponent({
  name: 'RosterTable',
  props: {
    members: {
      type: Array as PropType<RosterMember[]>,
      required: true,
    },
    editable: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['delete', 'edit'],
  setup(_, { emit }) {
    const editingIndex = ref<number | null>(null);
    const editValue = ref('');

    function startEdit(m: RosterMember, i: number) {
      editingIndex.value = i;
      editValue.value = m._entry ?? m.name ?? '';
    }

    function cancelEdit() {
      editingIndex.value = null;
      editValue.value = '';
    }

    function saveEdit(m: RosterMember, _i: number) {
      const newEntry = editValue.value.trim();
      if (newEntry && newEntry !== m._entry) {
        emit('edit', { oldEntry: m._entry, newEntry });
      }
      cancelEdit();
    }

    return { editingIndex, editValue, startEdit, cancelEdit, saveEdit };
  },
});
</script>

<style lang="scss" scoped>
.roster-wrap {
  background: #1f2023;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  overflow-x: auto;
  overflow-y: hidden;
}

.roster-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  table-layout: fixed;

  .col-name  { width: auto; min-width: 140px; }
  .col-num   { width: 90px; }
  .col-vault { width: 150px; }

  thead tr { background: #252629; }

  th {
    padding: 12px 18px;
    color: #6e7074;
    font-size: 0.67rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    text-align: center;
    white-space: nowrap;

    &.col-name { text-align: left; }

    @media (max-width: 768px) { padding: 10px 10px; }
  }

  tbody tr {
    transition: background 0.1s;
    &:nth-child(even):not(.separator-row) { background: rgba(255, 255, 255, 0.02); }
    &:not(.separator-row):hover { background: rgba(255, 255, 255, 0.05); }
  }

  td {
    padding: 12px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    vertical-align: middle;
    text-align: center;
    color: #b0b0b0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    @media (max-width: 768px) { padding: 10px 10px; }
  }

  tbody tr:last-child td { border-bottom: none; }
}

// Separator row — thin gap
.separator-row td {
  padding: 0;
  height: 10px;
  background: #191b1e !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

// Empty row — full-height blank slot
.empty-row td {
  padding: 0;
  height: 45px;
  background: rgba(255, 255, 255, 0.01) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

// Name cell
.char-name {
  text-align: left !important;
}

.char-label, .char-link {
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: 0.01em;
}

.char-link {
  text-decoration: none;
  color: inherit; /* fallback if classColor not yet loaded */
  &:hover { text-decoration: underline; }
  &:visited { color: inherit; }
}

// Numeric cells
.ilvl {
  color: #c9a227;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.keys, .highest {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: #c4c4c4;
}

// Vault slots
.vault-slot {
  display: inline-block;
  width: 38px;
  text-align: center;
  padding: 3px 0;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  border: 1px solid transparent;

  & + & { margin-left: 4px; }

  &--unlocked {
    color: #c084f5;
    background: rgba(192, 132, 245, 0.1);
    border-color: rgba(192, 132, 245, 0.25);
  }

  &--locked {
    color: #3a3d42;
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.05);
  }
}

// Actions column
.col-actions {
  width: 72px;
}

.actions-cell {
  white-space: nowrap;
  text-align: center !important;
}

.action-btn {
  background: transparent;
  border: none;
  color: #6e7074;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  line-height: 1;
  transition: color 0.15s;

  &:hover { color: #c0c0c0; }

  &--delete:hover { color: #c0392b; }

  & + & { margin-left: 2px; }
}

.edit-input {
  background: #252629;
  border: 1px solid rgba(201, 162, 39, 0.4);
  border-radius: 4px;
  color: #e8e8e8;
  font-size: 0.85rem;
  padding: 3px 6px;
  width: 100%;
  outline: none;

  &:focus { border-color: #c9a227; }
}
</style>
