<template>
  <div>
    <div class="recruit-hero">
      <div class="recruit-hero-content">
        <h1 class="recruit-headline">We Are Recruiting</h1>
        <p class="recruit-sub">
          Actively looking for dedicated raiders. Even if your class isn't
          listed — if you're good, apply anyway.
        </p>

        <div class="recruit-roles">
          <div class="role-card">
            <span class="role-icon">🩹</span>
            <span class="role-name">Healer</span>
            <span class="role-status">Open</span>
          </div>
          <div class="role-card">
            <span class="role-icon">🛡️</span>
            <span class="role-name">Tank</span>
            <span class="role-status">Open</span>
          </div>
          <div class="role-card">
            <span class="role-icon">⚔️</span>
            <span class="role-name">DPS</span>
            <span class="role-status">1–2 spots</span>
          </div>
        </div>

        <div class="recruit-schedule">
          <div class="recruit-schedule-item">
            <span class="recruit-schedule-label">Days</span>
            <span class="recruit-schedule-value">Thu · Sun · Mon</span>
          </div>
          <div class="recruit-schedule-divider"></div>
          <div class="recruit-schedule-item">
            <span class="recruit-schedule-label">Time</span>
            <span class="recruit-schedule-value">19:30 – 23:00 ST</span>
          </div>
          <div class="recruit-schedule-divider"></div>
          <div class="recruit-schedule-item">
            <span class="recruit-schedule-label">Farm</span>
            <span class="recruit-schedule-value">Sunday only</span>
          </div>
        </div>

        <div class="recruit-actions">
          <a
            href="https://docs.google.com/forms/d/1e8VIW384PbVKMWmp-QBuJ2O7ipDqcNPPfoWqBcD4o9o/"
            target="_blank"
            class="recruit-apply-btn"
            >Apply Now</a
          >
          <div class="recruit-officers">
            <span class="recruit-officers-label">Or contact:</span>
            <a
              href="https://discord.com/users/235367258833158144"
              target="_blank"
              class="recruit-officer"
              >@ari03024</a
            >
            <a
              href="https://discord.com/users/228927085870055425"
              target="_blank"
              class="recruit-officer"
              >@naskjaer</a
            >
            <a
              href="https://discord.com/users/147791234771976192"
              target="_blank"
              class="recruit-officer"
              >@LFX</a
            >
          </div>
        </div>
      </div>
    </div>
    <about-us />
  </div>
</template>

<script lang="ts">
import AboutUs from "./AboutUs.vue";
export default {
  components: {
    AboutUs,
  },
};
</script>

<style lang="scss">
@use "./homestart.scss";
</style>
