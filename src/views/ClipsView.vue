<template>
  <div class="clips-view">
    <div class="section-header">
      <div>
        <h2>Clips</h2>
        <p class="subtitle">Guild highlights — Twitch clips &amp; YouTube videos</p>
      </div>
    </div>

    <!-- Submit form (logged-in only) -->
    <form v-if="currentUserId" class="submit-form" @submit.prevent="submitClip">
      <div class="form-row">
        <input
          v-model.trim="newUrl"
          type="url"
          class="url-input"
          placeholder="Paste a Twitch clip or YouTube URL…"
          maxlength="2048"
          required
        />
        <input
          v-model.trim="newTitle"
          type="text"
          class="title-input"
          placeholder="Optional title (max 100 chars)"
          maxlength="100"
        />
        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? 'Adding…' : 'Add Clip' }}
        </button>
      </div>
      <p v-if="submitError" class="form-error" v-text="submitError" />
    </form>

    <!-- Feed -->
    <div v-if="loading" class="state-msg">Loading clips…</div>
    <div v-else-if="fetchError" class="state-msg error" v-text="fetchError" />
    <div v-else-if="clips.length === 0" class="state-msg">No clips yet — be the first!</div>

    <div v-else class="clips-grid">
      <ClipCard
        v-for="clip in clips"
        :key="clip.id"
        :clip="clip"
        :currentUserId="currentUserId"
        @deleted="onDeleted"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import ClipCard from '../components/ClipCard.vue';
import type { ClipObject } from '../types/clips';

export default defineComponent({
  name: 'ClipsView',
  components: { ClipCard },
  setup() {
    const clips = ref<ClipObject[]>([]);
    const currentUserId = ref<string | null>(null);
    const loading = ref(true);
    const fetchError = ref<string | null>(null);
    const newUrl = ref('');
    const newTitle = ref('');
    const submitting = ref(false);
    const submitError = ref<string | null>(null);

    onMounted(async () => {
      try {
        const [meRes, clipsRes] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/clips', { credentials: 'include' }),
        ]);

        if (meRes.ok) {
          const me = await meRes.json();
          currentUserId.value = me.id ?? null;
        }

        if (!clipsRes.ok) {
          fetchError.value = clipsRes.status === 401
            ? 'Please log in to view clips'
            : 'Failed to load clips, please try again';
        } else {
          const data = await clipsRes.json();
          clips.value = data.clips ?? [];
        }
      } catch {
        fetchError.value = 'Network error — please check your connection and refresh';
      } finally {
        loading.value = false;
      }
    });

    async function submitClip() {
      submitError.value = null;
      submitting.value = true;
      try {
        const res = await fetch('/api/clips', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: newUrl.value, title: newTitle.value }),
        });
        if (!res.ok) {
          let message = 'Failed to add clip';
          try {
            const data = await res.json();
            message = data.error ?? message;
          } catch { /* non-JSON error body */ }
          submitError.value = message;
          return;
        }
        const data = await res.json();
        clips.value = [data.clip, ...clips.value];
        newUrl.value = '';
        newTitle.value = '';
      } catch {
        submitError.value = 'Network error, please try again';
      } finally {
        submitting.value = false;
      }
    }

    function onDeleted(id: string) {
      clips.value = clips.value.filter((c) => c.id !== id);
    }

    return {
      clips, currentUserId, loading, fetchError,
      newUrl, newTitle, submitting, submitError,
      submitClip, onDeleted,
    };
  },
});
</script>

<style lang="scss" scoped>
.clips-view {
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

    @media (max-width: 768px) { font-size: 1.1rem; letter-spacing: 2px; }
  }

  .subtitle {
    color: #6e7074;
    font-size: 0.78rem;
    letter-spacing: 0.5px;
  }
}

.submit-form {
  margin-bottom: 2rem;

  .form-row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
}

.url-input {
  flex: 1 1 300px;
  min-width: 0;
  background: #1f2023;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e8e8e8;
  padding: 0.55rem 0.9rem;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s;

  &::placeholder { color: #555; }
  &:focus { border-color: rgba(201, 162, 39, 0.4); }
}

.title-input {
  flex: 0 1 220px;
  min-width: 0;
  background: #1f2023;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e8e8e8;
  padding: 0.55rem 0.9rem;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s;

  &::placeholder { color: #555; }
  &:focus { border-color: rgba(201, 162, 39, 0.4); }
}

.submit-btn {
  background: rgba(201, 162, 39, 0.12);
  border: 1px solid rgba(201, 162, 39, 0.3);
  color: #c9a227;
  padding: 0.55rem 1.2rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: rgba(201, 162, 39, 0.2);
    border-color: rgba(201, 162, 39, 0.5);
  }
  &:disabled { opacity: 0.5; cursor: default; }
}

.form-error {
  color: #dc3545;
  font-size: 0.8rem;
  margin-top: 0.5rem;
}

.state-msg {
  color: #555;
  padding: 60px 0;
  text-align: center;
  font-size: 0.9rem;
  letter-spacing: 1px;

  &.error { color: #c0392b; }
}

.clips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
