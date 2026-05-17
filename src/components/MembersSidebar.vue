<template>
  <div class="sidebar-progression-wrapper">
    <nav class="members-nav">
      <RouterLink to="/members" exact-active-class="active" class="nav-item">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">Home</span>
      </RouterLink>
      <RouterLink
        to="/members/characters"
        active-class="active"
        class="nav-item"
      >
        <span class="nav-icon">🧑‍🤝‍🧑</span>
        <span class="nav-label">Characters</span>
      </RouterLink>
      <RouterLink to="/members/roster" active-class="active" class="nav-item">
        <span class="nav-icon">📋</span>
        <span class="nav-label">Roster</span>
      </RouterLink>
      <RouterLink to="/members/absence" active-class="active" class="nav-item">
        <span class="nav-icon">📅</span>
        <span class="nav-label">Absence</span>
      </RouterLink>
      <RouterLink to="/members/sims" active-class="active" class="nav-item">
        <span class="nav-icon">📊</span>
        <span class="nav-label">Sims</span>
      </RouterLink>
      <RouterLink to="/members/clips" active-class="active" class="nav-item">
        <span class="nav-icon">🎬</span>
        <span class="nav-label">Clips</span>
      </RouterLink>
      <div class="nav-divider" />
      <RouterLink to="/" class="nav-item nav-item--back">
        <span class="nav-icon">←</span>
        <span class="nav-label">Guild Site</span>
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
$collapsed-w: 3.5rem;
$expanded-w: 14rem;
$transition: 0.28s cubic-bezier(0.4, 0, 0.2, 1);

.sidebar-progression-wrapper {
  background: #1a1b1e;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  height: 100vh;
  width: $collapsed-w;
  overflow: hidden;
  transition:
    width $transition,
    box-shadow $transition;
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0;
  left: 0;

  @media (min-width: 769px) {
    &:hover {
      width: $expanded-w;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
    }
  }

  @media (max-width: 768px) {
    position: static;
    width: 100%;
    height: auto;
    flex-direction: row;
    overflow: visible;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
}

.members-nav {
  padding: 0.6rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  .sidebar-progression-wrapper:hover & {
    padding: 0.6rem 0;
    gap: 0.15rem;
  }

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
  margin: 0.4rem 0;

  @media (max-width: 768px) {
    display: none;
  }
}

// Nav items: icon column is exactly $collapsed-w wide so it's always visible
.nav-item {
  display: flex;
  align-items: center;
  color: #8a8f98;
  text-decoration: none;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid transparent;
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;
  white-space: nowrap;

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

    .nav-icon {
      font-size: 0.9rem;
    }

    &:hover {
      color: #888;
      background: none;
    }
  }

  @media (max-width: 768px) {
    padding: 0.45rem 0.65rem;
    border-radius: 6px;
    border: 1px solid transparent;
    gap: 0.3rem;
  }
}

.nav-icon {
  width: $collapsed-w;
  height: 2.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: auto;
    height: auto;
    font-size: 1rem;
  }
}

.nav-label {
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  padding-right: 0.9rem;
  transition: opacity 0.15s 0.12s;

  .sidebar-progression-wrapper:hover & {
    opacity: 1;
  }

  @media (max-width: 768px) {
    opacity: 1;
  }
}
</style>
