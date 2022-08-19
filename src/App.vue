<template>
  <div class="main-wrapper">
    <SideBar
      class="sidebar"
      :currentPage="setActive"
      @change-page="setPage($event)"
    />
    <div class="component-wrapper">
      <HomeStart v-if="setActive === 1" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import SideBar from "./components/SideBar.vue";
import HomeStart from "./components/HomeStart.vue";

export default defineComponent({
  name: "App",
  components: {
    SideBar,
    HomeStart,
  },
  data() {
    return {
      setActive: 1,
    };
  },
  methods: {
    setPage(page: number) {
      this.setActive = page;
    },
  },
});
</script>

<style lang="scss">
@use "./app.scss";
</style>
