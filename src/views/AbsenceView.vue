<template>
  <div class="absence-view">
    <div class="section-header">
      <h2>Absence Sheet</h2>
      <p class="subtitle">
        Confirm your attendance for upcoming raid days · Thu · Sun · Mon
      </p>
    </div>

    <div v-if="loading" class="state-msg">Loading...</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>

    <div v-else class="table-wrap">
      <table class="absence-table">
        <thead>
          <!-- Row 1: month group headers -->
          <tr>
            <th class="col-player sticky-col" rowspan="2">Player</th>
            <th
              v-for="group in monthGroups"
              :key="group.month"
              :colspan="group.count"
              class="month-header"
            >
              {{ group.month }}
            </th>
          </tr>
          <!-- Row 2: individual date headers -->
          <tr>
            <th v-for="date in dates" :key="date" class="date-header">
              {{ formatDateHeader(date) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(entry, i) in members" :key="i">
            <!-- Separator row -->
            <tr v-if="entry === '---'" class="separator-row">
              <td :colspan="dates.length + 1" />
            </tr>
            <!-- Member row -->
            <tr v-else>
              <td class="col-player sticky-col player-name">
                {{ displayName(entry) }}
              </td>
              <td v-for="date in dates" :key="date" class="cell">
                <input
                  type="checkbox"
                  :checked="isAttending(entry, date)"
                  :disabled="isSaving(entry, date)"
                  @change="toggle(entry, date, $event)"
                  class="attendance-check"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="toggleError" class="toggle-error">{{ toggleError }}</div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from "vue";

interface AbsenceApiResponse {
  dates: string[];
  members: string[];
  attendance: Record<string, string[]>;
}

export default defineComponent({
  name: "AbsenceView",
  setup() {
    const loading = ref(true);
    const error = ref<string | null>(null);
    const toggleError = ref<string | null>(null);
    let toggleErrorTimer: ReturnType<typeof setTimeout> | null = null;

    const dates = ref<string[]>([]);
    const members = ref<string[]>([]);
    // attendance: Record<date, entry[]>
    const attendance = ref<Record<string, string[]>>({});
    // saving: Set of "entry|date" keys currently in-flight
    const saving = ref<Set<string>>(new Set());

    function cellKey(entry: string, date: string) {
      return `${entry}|${date}`;
    }

    // KV stores absent members — checked (attending) = NOT in the absent list
    function isAttending(entry: string, date: string): boolean {
      return !(attendance.value[date] ?? []).includes(entry);
    }

    function isSaving(entry: string, date: string): boolean {
      return saving.value.has(cellKey(entry, date));
    }

    function displayName(entry: string): string {
      const dash = entry.indexOf("-");
      return dash === -1 ? entry : entry.slice(0, dash);
    }

    // Format "2026-05-15" → "Thu 15"
    function formatDateHeader(dateStr: string): string {
      const d = new Date(dateStr + "T00:00:00");
      const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
      return `${day} ${d.getDate()}`;
    }

    // Group dates by "Month YYYY" for colspan headers
    const monthGroups = computed(() => {
      const groups: { month: string; count: number }[] = [];
      for (const date of dates.value) {
        const d = new Date(date + "T00:00:00");
        const label = d.toLocaleString("en-GB", {
          month: "long",
          year: "numeric",
        });
        if (groups.length && groups[groups.length - 1].month === label) {
          groups[groups.length - 1].count++;
        } else {
          groups.push({ month: label, count: 1 });
        }
      }
      return groups;
    });

    async function toggle(entry: string, date: string, event: Event) {
      const checked = (event.target as HTMLInputElement).checked;
      const key = cellKey(entry, date);

      // Optimistic update: array stores absences (unchecked = absent)
      // checked=true (attending) → remove from absent list
      // checked=false (absent)   → add to absent list
      const current = attendance.value[date] ?? [];
      if (checked) {
        attendance.value[date] = current.filter((e) => e !== entry);
      } else {
        attendance.value[date] = current.includes(entry)
          ? current
          : [...current, entry];
      }

      saving.value = new Set(saving.value).add(key);

      try {
        const res = await fetch("/api/absence", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          // API: checked=true adds to array, checked=false removes — so invert
          body: JSON.stringify({ date, entry, checked: !checked }),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
      } catch {
        // Revert: undo the optimistic update
        if (checked) {
          attendance.value[date] = current.includes(entry)
            ? current
            : [...current, entry];
        } else {
          attendance.value[date] = current.filter((e) => e !== entry);
        }
        // Show error
        if (toggleErrorTimer) clearTimeout(toggleErrorTimer);
        toggleError.value = "Failed to save — please try again";
        toggleErrorTimer = setTimeout(() => {
          toggleError.value = null;
        }, 4000);
      } finally {
        const next = new Set(saving.value);
        next.delete(key);
        saving.value = next;
      }
    }

    onMounted(async () => {
      try {
        const res = await fetch("/api/absence", { credentials: "include" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as AbsenceApiResponse;
        dates.value = data.dates ?? [];
        members.value = data.members ?? [];
        attendance.value = data.attendance ?? {};
      } catch (e: any) {
        error.value = e?.message ?? "Failed to load absence sheet";
      } finally {
        loading.value = false;
      }
    });

    return {
      loading,
      error,
      toggleError,
      dates,
      members,
      attendance,
      monthGroups,
      isAttending,
      isSaving,
      displayName,
      formatDateHeader,
      toggle,
    };
  },
});
</script>

<style lang="scss" scoped>
.absence-view {
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

  .toggle-error {
    margin-top: 0.75rem;
    color: #c0392b;
    font-size: 0.8rem;
    text-align: center;
  }
}

.table-wrap {
  background: #1f2023;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  overflow-x: auto;
}

.absence-table {
  border-collapse: collapse;
  font-size: 0.875rem;
  white-space: nowrap;

  th,
  td {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    text-align: center;
    vertical-align: middle;

    &:last-child {
      border-right: none;
    }
  }

  thead tr:first-child th {
    background: #252629;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  thead tr:last-child th {
    background: #252629;
    color: #6e7074;
    font-size: 0.67rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  }

  .month-header {
    color: #c9a227;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }

  // Highlight entire column on cell hover
  .cell:hover {
    background: rgba(201, 162, 39, 0.07);
  }

  tbody tr {
    &:nth-child(even):not(.separator-row) {
      background: rgba(255, 255, 255, 0.02);
    }
    &:not(.separator-row):hover {
      background: rgba(255, 255, 255, 0.04);
    }
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.sticky-col {
  position: sticky;
  left: 0;
  background: #1f2023;
  z-index: 2;
  text-align: left !important;
  min-width: 130px;
  border-right: 1px solid rgba(255, 255, 255, 0.07);
}

tbody tr:not(.separator-row):hover .sticky-col {
  background: #252629;
}

tbody tr:nth-child(even):not(.separator-row) .sticky-col {
  background: #202225;
}

thead .sticky-col {
  background: #252629;
  z-index: 3;
}

.col-player {
  font-size: 0.67rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: #6e7074;
}

.player-name {
  color: #c8c8c8;
  font-weight: 600;
  font-size: 0.875rem;
}

.separator-row td {
  padding: 0;
  height: 10px;
  background: #191b1e !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

// Custom gold checkbox
.attendance-check {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
  vertical-align: middle;

  &:checked {
    background: #c9a227;
    border-color: #c9a227;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 10 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4l3 3 5-6' stroke='%23000' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 10px 8px;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    border-color: #c9a227;
  }
}
</style>
