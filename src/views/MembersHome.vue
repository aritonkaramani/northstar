<template>
  <div class="members-home">
    <div class="section-header">
      <h1>Members Area</h1>
      <p class="subtitle" v-if="user">
        Logged in as <span class="battletag">{{ user.battleTag }}</span>
      </p>
    </div>
    <p class="hint">Use the sidebar to navigate.</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useAuth } from '../composables/useAuth';

export default defineComponent({
  name: 'MembersHome',
  setup() {
    const { user } = useAuth();
    return { user };
  },
});
</script>

<style lang="scss" scoped>
.members-home {
  .section-header {
    padding-bottom: 1.2rem;
    margin-bottom: 0.6rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  h1 {
    font-size: 1.4rem;
    color: #e8e8e8;
    font-weight: 900;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 0.3rem;
  }

  .subtitle {
    font-size: 0.82rem;
    color: #666;
    margin: 0;
  }

  .battletag {
    color: #c9a227;
    font-weight: 600;
  }

  .hint {
    color: #444;
    font-size: 0.85rem;
    margin-top: 1.2rem;
  }
}
</style>
