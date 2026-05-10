<template>
  <div class="sims-upload">
    <div class="upload-row">
      <!-- Drop zone -->
      <div
        class="drop-zone"
        :class="{
          'drop-zone--over': isDragOver,
          'drop-zone--success': lastSuccess,
          'drop-zone--error': uploadError,
        }"
        @dragover.prevent="isDragOver = true"
        @dragleave="isDragOver = false"
        @drop.prevent="onDrop"
        @click="triggerBrowse"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".csv"
          style="display:none"
          @change="onFileChange"
        />
        <div v-if="uploading" class="drop-zone-inner">
          <span class="drop-icon">⏳</span>
          <span class="drop-label">Uploading…</span>
        </div>
        <div v-else-if="lastSuccess" class="drop-zone-inner">
          <span class="drop-icon">✅</span>
          <span class="drop-label">{{ lastSuccess }} uploaded!</span>
          <span class="drop-hint">Drop another to replace</span>
        </div>
        <div v-else-if="uploadError" class="drop-zone-inner">
          <span class="drop-icon">❌</span>
          <span class="drop-label error-text">{{ uploadError }}</span>
          <span class="drop-hint">Click or drop to try again</span>
        </div>
        <div v-else class="drop-zone-inner">
          <span class="drop-icon">📂</span>
          <span class="drop-label">Drop your droptimizer CSV here</span>
          <span class="drop-hint">or click to browse · no renaming needed · max 50 KB</span>
        </div>
      </div>

      <!-- Status chips -->
      <div class="chips-panel">
        <div class="chips-title">Uploaded this week</div>
        <div v-if="expected.length" class="chips-grid">
          <div
            v-for="item in expectedWithStatus"
            :key="item.name"
            :class="['chip', item.uploaded ? 'chip--done' : 'chip--pending']"
          >
            <span class="chip-dot" />
            <span class="chip-name">{{ item.displayName }}</span>
            <span v-for="spec in item.specs" :key="spec" class="chip-spec">{{ spec }}</span>
          </div>
        </div>
        <div v-else class="chips-empty">No roster data available</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed } from 'vue';

interface Uploader {
  name: string;
  spec: string;
  battletag: string;
  uploadedAt: string;
}

export default defineComponent({
  name: 'SimsUpload',

  props: {
    difficulty: { type: String, required: true },
    uploaders:  { type: Array as PropType<Uploader[]>, default: () => [] },
    expected:   { type: Array as PropType<string[]>,   default: () => [] },
  },

  emits: ['uploaded'],

  setup(props, { emit }) {
    const isDragOver  = ref(false);
    const uploading   = ref(false);
    const lastSuccess = ref<string | null>(null);
    const uploadError = ref<string | null>(null);
    const fileInput   = ref<HTMLInputElement | null>(null);

    // Find ALL uploaders whose stored name contains the roster name (or exact match).
    // Handles cases like "aniimuzzmythic" matching roster player "aniimuzz".
    function findUploaders(rosterName: string): Uploader[] {
      const needle = rosterName.toLowerCase();
      return props.uploaders.filter(u => {
        const hay = u.name.toLowerCase();
        return hay === needle || hay.includes(needle);
      });
    }

    const expectedWithStatus = computed(() =>
      props.expected.map(name => {
        const uploaders = findUploaders(name);
        return {
          name,
          displayName: name.charAt(0).toUpperCase() + name.slice(1),
          uploaded: uploaders.length > 0,
          specs: uploaders.map(u => u.spec),
        };
      })
    );

    function triggerBrowse() {
      fileInput.value?.click();
    }

    async function uploadFile(file: File) {
      uploadError.value = null;
      lastSuccess.value = null;
      uploading.value = true;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('difficulty', props.difficulty);

      try {
        const res = await fetch('/api/sims-upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
        lastSuccess.value = `${data.name}_${data.spec}`;
        emit('uploaded');
      } catch (e: any) {
        uploadError.value = e?.message ?? 'Upload failed';
      } finally {
        uploading.value = false;
        isDragOver.value = false;
      }
    }

    function onDrop(e: DragEvent) {
      const file = e.dataTransfer?.files?.[0];
      if (file) uploadFile(file);
    }

    function onFileChange(e: Event) {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) uploadFile(file);
    }

    return {
      isDragOver, uploading, lastSuccess, uploadError, fileInput,
      expectedWithStatus, triggerBrowse, onDrop, onFileChange,
    };
  },
});
</script>

<style lang="scss" scoped>
.sims-upload {
  margin-bottom: 0.5rem;
}

.upload-row {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.drop-zone {
  flex: 0 0 260px;
  min-height: 110px;
  background: #1f2023;
  border: 2px dashed rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;

  &:hover,
  &--over {
    border-color: rgba(201, 162, 39, 0.4);
    background: rgba(201, 162, 39, 0.04);
  }
  &--success {
    border-color: rgba(74, 222, 128, 0.4);
    background: rgba(74, 222, 128, 0.04);
  }
  &--error {
    border-color: rgba(220, 53, 69, 0.4);
    background: rgba(220, 53, 69, 0.04);
  }
}

.drop-zone-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 1.2rem;
  text-align: center;
  pointer-events: none;
}

.drop-icon { font-size: 1.5rem; }

.drop-label {
  color: #b0b0b0;
  font-size: 0.85rem;
  code {
    color: #c9a227;
    background: rgba(201, 162, 39, 0.1);
    border: 1px solid rgba(201, 162, 39, 0.2);
    border-radius: 3px;
    padding: 1px 4px;
    font-size: 0.8rem;
  }
  &.error-text { color: #dc3545; }
}

.drop-hint {
  color: #4e5057;
  font-size: 0.72rem;
}

/* Chips */
.chips-panel { flex: 1; min-width: 0; }

.chips-title {
  font-size: 0.67rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #6e7074;
  margin-bottom: 0.6rem;
}

.chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.78rem;
  border: 1px solid transparent;

  &--done {
    background: rgba(74, 222, 128, 0.08);
    border-color: rgba(74, 222, 128, 0.2);
    color: #4ade80;
  }
  &--pending {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.06);
    color: #4e5057;
  }
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.chip-name { font-weight: 600; }

.chip-spec {
  font-size: 0.7rem;
  opacity: 0.7;
}

.chips-empty {
  color: #4e5057;
  font-size: 0.8rem;
}
</style>
