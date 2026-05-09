<template>
  <div class="main-wrapper">
    <div class="sidebar">
      <SideBarProgression />
    </div>
    <div class="component-wrapper">
      <SideBarTop />
      <HomeStart />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import SideBarTop from "../components/SideBarTop.vue";
import SideBarProgression from "../components/SideBarProgression.vue";
import HomeStart from "../components/HomeStart.vue";

export default defineComponent({
  name: "HomeView",
  components: {
    SideBarTop,
    SideBarProgression,
    HomeStart,
  },
});
</script>
