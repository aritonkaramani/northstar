<template>
  <div class="main-wrapper">
    <SideBar
      class="sidebar"
      :currentPage="setActive"
      @change-page="setPage($event)"
    />
    <div class="component-wrapper">
      <Home v-if="setActive === 1" />
      <Streams v-if="setActive === 3" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import axios from "axios";
import SideBar from "./components/SideBar.vue";
import Home from "./components/Home.vue";
import Streams from "./components/TwitchStreams.vue";

export default defineComponent({
  name: "App",
  components: {
    SideBar,
    Home,
    Streams,
  },
  data() {
    return {
      setActive: 1,
    };
  },
  mounted() {
    this.getCred();
  },
  methods: {
    setPage(page: number) {
      this.setActive = page;
    },
    async getCred() {
      await axios
        .request({
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          url: "https://eu.battle.net/oauth/token",
          method: "post",
          data: "grant_type=client_credentials",
          auth: {
            username: "1a32ab7a1aad448e8bf8cf44d6afd14f",
            password: "wQtMOZsR2ivdpMXgW6d2Nre6FmwV50do",
          },
        })
        .then((res) => {
          console.log(res);
        });
    },
  },
});
</script>

<style lang="scss">
@use "./app.scss";
</style>
