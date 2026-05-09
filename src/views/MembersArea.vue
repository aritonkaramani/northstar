<template>
  <div class="members-wrapper">
    <div class="sidebar">
      <MembersSidebar />
    </div>
    <div class="component-wrapper">
      <RouterView />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import MembersSidebar from '../components/MembersSidebar.vue';

export default defineComponent({
  name: 'MembersArea',
  components: { MembersSidebar },
});
</script>

<style lang="scss" scoped>
.members-wrapper {
  width: 100%;
  max-width: 140rem;
  margin: 0 auto;
  align-self: stretch;
  background-color: #141517;
  display: flex;
  flex: 1;
  flex-direction: row;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  border-right: 1px solid rgba(255, 255, 255, 0.05);

  .sidebar {
    padding: 0;
    width: 14rem;
    min-width: 14rem;
    background-color: #1a1b1e;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    align-self: flex-start;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: hidden;
  }

  .component-wrapper {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    background-color: #141517;
    padding-left: 2.5rem;
    padding-right: 2.5rem;
    padding-top: 2rem;
    padding-bottom: 2rem;
  }
}
</style>

