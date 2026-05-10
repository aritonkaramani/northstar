<template>
  <div class="clip-card">
    <div class="embed-wrapper">
      <template v-if="clip.embedUrl">
        <iframe
          :src="clip.embedUrl"
          class="embed-frame"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen
        />
      </template>
      <div v-else class="embed-unavailable">Embed unavailable</div>
    </div>
    <div class="clip-meta">
      <div class="clip-info">
        <span v-if="clip.title" class="clip-title" v-text="clip.title" />
        <span class="clip-author">
          <span class="platform-badge" :class="`platform-badge--${clip.platform}`">
            {{ clip.platform === 'twitch' ? 'Twitch' : 'YouTube' }}
          </span>
          added by <strong v-text="clip.addedBy" /> · {{ timeAgo }}
        </span>
      </div>
      <template v-if="currentUserId && currentUserId === clip.addedById">
        <button
          v-if="!confirmDelete"
          class="delete-btn"
          @click="requestDelete"
          title="Remove clip"
          aria-label="Remove clip"
        >
          ✕
        </button>
        <div v-else class="delete-confirm">
          <button class="delete-btn delete-btn--confirm" :disabled="deleting" @click="deleteClip" aria-label="Confirm remove clip">
            {{ deleting ? '…' : 'Remove?' }}
          </button>
          <button class="delete-btn delete-btn--cancel" @click="cancelDelete" aria-label="Cancel">
            ✕
          </button>
        </div>
      </template>
    </div>
    <p v-if="deleteError" class="delete-error" v-text="deleteError" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed, onMounted, onUnmounted } from 'vue';
import type { ClipObject } from '../types/clips';

export default defineComponent({
  name: 'ClipCard',
  props: {
    clip: { type: Object as PropType<ClipObject>, required: true },
    currentUserId: { type: String as PropType<string | null>, default: null },
  },
  emits: ['deleted'],
  setup(props, { emit }) {
    const deleting = ref(false);
    const deleteError = ref<string | null>(null);
    const confirmDelete = ref(false);
    let confirmTimer: ReturnType<typeof setTimeout> | null = null;

    const now = ref(Math.floor(Date.now() / 1000));
    let timeTimer: ReturnType<typeof setInterval> | null = null;

    onMounted(() => {
      timeTimer = setInterval(() => { now.value = Math.floor(Date.now() / 1000); }, 30_000);
    });

    onUnmounted(() => {
      if (timeTimer) clearInterval(timeTimer);
      if (confirmTimer) clearTimeout(confirmTimer);
    });

    const timeAgo = computed(() => {
      const seconds = now.value - props.clip.addedAt;
      if (seconds < 60) return 'just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    });

    function requestDelete() {
      confirmDelete.value = true;
      confirmTimer = setTimeout(() => { confirmDelete.value = false; }, 4000);
    }

    function cancelDelete() {
      confirmDelete.value = false;
      if (confirmTimer) clearTimeout(confirmTimer);
    }

    async function deleteClip() {
      if (deleting.value) return;
      if (confirmTimer) { clearTimeout(confirmTimer); confirmTimer = null; }
      deleteError.value = null;
      deleting.value = true;
      try {
        const res = await fetch(`/api/clips/${props.clip.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          emit('deleted', props.clip.id);
        } else {
          const data = await res.json().catch(() => ({}));
          deleteError.value = data.error ?? 'Failed to remove clip';
          confirmTimer = setTimeout(() => { confirmDelete.value = false; }, 4000);
        }
      } catch {
        deleteError.value = 'Network error, please try again';
        confirmTimer = setTimeout(() => { confirmDelete.value = false; }, 4000);
      } finally {
        deleting.value = false;
      }
    }

    return { timeAgo, deleting, deleteError, confirmDelete, deleteClip, requestDelete, cancelDelete };
  },
});
</script>

<style lang="scss" scoped>
.clip-card {
  background: #1f2023;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  overflow: hidden;
}

.embed-wrapper {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 */
  background: #000;

  .embed-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
  }
}

.clip-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

.clip-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.clip-title {
  color: #e8e8e8;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-author {
  color: #6e7074;
  font-size: 0.75rem;

  strong { color: #b0b0b0; }
}

.platform-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 4px;

  &--twitch {
    background: rgba(145, 70, 255, 0.15);
    color: #9146ff;
    border: 1px solid rgba(145, 70, 255, 0.3);
  }
  &--youtube {
    background: rgba(255, 0, 0, 0.12);
    color: #ff4444;
    border: 1px solid rgba(255, 0, 0, 0.25);
  }
}

.delete-btn {
  flex-shrink: 0;
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.25);
  color: #dc3545;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: rgba(220, 53, 69, 0.2);
    border-color: rgba(220, 53, 69, 0.4);
  }
  &:disabled { opacity: 0.5; cursor: default; }
}

.delete-confirm {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.delete-btn--confirm {
  width: auto;
  padding: 0 8px;
  font-size: 0.7rem;
}

.delete-btn--cancel {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #999;
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }
}

.delete-error {
  color: #dc3545;
  font-size: 0.75rem;
  padding: 0.25rem 1rem 0.5rem;
  margin: 0;
}

.embed-unavailable {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  font-size: 0.85rem;
}
</style>
