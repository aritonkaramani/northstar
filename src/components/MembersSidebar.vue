<template>
  <div class="sidebar-progression-wrapper">
    <div class="content-header">
      <div class="content-header-left">
        <span class="sidebar-title">MEMBERS</span>
      </div>
    </div>
    <nav class="members-nav">
      <p class="sidebar-progression-title">Navigation</p>
      <RouterLink to="/members" exact-active-class="active" class="nav-item">
        🏠 Home
      </RouterLink>
      <RouterLink
        to="/members/characters"
        active-class="active"
        class="nav-item"
      >
        🧑‍🤝‍🧑 Characters
      </RouterLink>
      <RouterLink to="/members/roster" active-class="active" class="nav-item">
        📋 Roster
      </RouterLink>
      <RouterLink to="/members/absence" active-class="active" class="nav-item">
        📅 Absence
      </RouterLink>
      <RouterLink to="/members/sims" active-class="active" class="nav-item">
        📊 Sims
      </RouterLink>
      <RouterLink to="/members/clips" active-class="active" class="nav-item">
        🎬 Clips
      </RouterLink>
      <div class="nav-divider" />
      <RouterLink to="/" class="nav-item nav-item--back">
        ← Guild Site
      </RouterLink>
    </nav>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({ name: "MembersSidebar" });
</script>

<style lang="scss">
@use "./sidebar.scss";
</style>

<style lang="scss" scoped>
.sidebar-progression-wrapper {
  @media (max-width: 768px) {
    display: flex;
    align-items: center;

    .content-header {
      display: none;
    }

    .sidebar-progression-title {
      display: none;
    }
  }
}

.members-nav {
  padding: 1.2rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  @media (max-width: 768px) {
    flex-direction: row;
    flex-wrap: wrap;
    padding: 0.6rem 0.75rem;
    gap: 0.25rem;
  }
}

.nav-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.04);
  margin: 0.5rem 0.8rem;
}

.nav-item {
  display: block;
  padding: 0.6rem 0.8rem;
  color: #8a8f98;
  text-decoration: none;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid transparent;
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;

  &:hover {
    color: #e0e0e0;
    background: rgba(255, 255, 255, 0.05);
  }

  &.active {
    color: #c9a227;
    background: rgba(201, 162, 39, 0.08);
    border-color: rgba(201, 162, 39, 0.2);
  }

  &.nav-item--back {
    color: #555;
    font-size: 0.8rem;

    &:hover {
      color: #888;
      background: none;
    }
  }
}
</style>
