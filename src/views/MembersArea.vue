<template>
  <div class="members-area">
    <h1>Members Area</h1>
    <p v-if="user">Welcome, <span class="battletag">{{ user.battleTag }}</span>! ⚔️</p>
    <p class="coming-soon">More content coming soon...</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useAuth } from '../composables/useAuth';

export default defineComponent({
  name: 'MembersArea',
  setup() {
    const { user } = useAuth();
    return { user };
  },
});
</script>

<style lang="scss" scoped>
.members-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: #e0e0e0;
  text-align: center;

  h1 {
    font-size: 2.5rem;
    color: #e2b84b;
    margin-bottom: 1rem;
  }

  .battletag {
    color: #e2b84b;
    font-weight: bold;
  }

  .coming-soon {
    color: #666;
    font-size: 1.1rem;
    margin-top: 0.5rem;
  }
}
</style>
