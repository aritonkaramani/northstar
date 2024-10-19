<template>
  <nav class="sidebar-wrapper">
    <span class="sidebar-title">NORTHSTAR</span>
    <img src="../assets/northstar-no-name.png" class="northstar-logo" />
    <div class="external-links">
      <ul>
        <li>
          <a href="https://raider.io/guilds/eu/ravencrest/northstar" target="_blank">
            <img src="../assets/raiderioicon.svg" />
          </a>
        </li>
        <li>
          <a href="https://www.warcraftlogs.com/guild/eu/ravencrest/northstar" target="_blank">
            <img src="../assets/wclogsicon.png" />
          </a>
        </li>
        <li class="wowprogress-icon">
          <a href="https://www.wowprogress.com/guild/eu/ravencrest/Northstar" target="_blank">W</a>
        </li>
      </ul>
    </div>
    <a href="https://docs.google.com/forms/d/1e8VIW384PbVKMWmp-QBuJ2O7ipDqcNPPfoWqBcD4o9o/" target="_blank">
      <button>
        Apply Here
      </button>
    </a>
    <div class="nav-links">
      <ul class="link-section">
        <li :class="currentPage === 1 ? 'active' : ''" @click="$emit('change-page', 1)">
          HOME
        </li>
        <!-- <li
          :class="currentPage === 2 ? 'active' : ''"
          @click="$emit('change-page', 2)"
        >
          ROSTER
        </li>
        <li
          :class="currentPage === 3 ? 'active' : ''"
          @click="$emit('change-page', 3)"
        >
          STREAMS
        </li> -->
        <!-- <li :class="currentPage === 4 ? 'active' : ''" @click="$emit('change-page', 4)">NONAME</li> -->
      </ul>
    </div>
  </nav>
</template>

<script lang="ts">
export default {
  props: {
    msg: String,
    currentPage: { Number, default: 1 },
  },
};
</script>

<style lang="scss">
@use "./sidebar.scss";
</style>
