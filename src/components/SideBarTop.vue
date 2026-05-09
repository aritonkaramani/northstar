<template>
  <div class="content-header">
    <div class="content-header-left">
      <img src="../assets/northstar-no-name.png" class="northstar-logo" />
      <span class="sidebar-title">NORTHSTAR</span>
      <div class="header-ranks" v-if="ranks">
        <span class="header-rank-item" title="World Rank">
          <span class="header-rank-label">World</span>
          <span class="header-rank-value">#{{ ranks.world_rank }}</span>
        </span>
        <span class="header-rank-divider"></span>
        <span class="header-rank-item" title="EU Rank">
          <span class="header-rank-label">EU</span>
          <span class="header-rank-value">#{{ ranks.area_rank }}</span>
        </span>
        <span class="header-rank-divider"></span>
        <span class="header-rank-item" title="Realm Rank">
          <span class="header-rank-label">Realm</span>
          <span class="header-rank-value">#{{ ranks.realm_rank }}</span>
        </span>
      </div>
    </div>
    <div class="external-links">
      <ul>
        <li v-if="user">
          <RouterLink to="/members" class="text-icon-link members-link" title="Members Area">M</RouterLink>
        </li>
        <li>
          <a href="https://raider.io/guilds/eu/ravencrest/northstar" target="_blank" title="Raider.io">
            <img src="../assets/raiderioicon.svg" />
          </a>
        </li>
        <li>
          <a href="https://www.warcraftlogs.com/guild/eu/ravencrest/northstar" target="_blank" title="WarcraftLogs">
            <img src="../assets/wclogsicon.png" />
          </a>
        </li>
        <li class="text-icon-link">
          <a href="https://www.wowprogress.com/guild/eu/ravencrest/Northstar" target="_blank" title="WoWProgress">W</a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useAuth } from '../composables/useAuth';

interface GuildRank {
  score: string;
  world_rank: string;
  area_rank: string;
  realm_rank: string;
}

export default defineComponent({
  setup() {
    const { user } = useAuth();
    return { user };
  },
  data() {
    return {
      ranks: null as GuildRank | null,
    };
  },
  async mounted() {
    try {
      const res = await fetch(
        'https://www.wowprogress.com/guild/eu/ravencrest/Northstar/json_rank'
      );
      if (res.ok) {
        this.ranks = await res.json();
      }
    } catch {
      // silently fail — ranks stay hidden
    }
  },
});
</script>

<style lang="scss">
@use "./sidebar.scss";
</style>
