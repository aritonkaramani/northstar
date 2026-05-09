<template>
  <div>
    <div class="top-nav">
      <LoginButton />
    </div>
    <div v-if="errorMessage" class="auth-error">{{ errorMessage }}</div>
    <RouterView />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useRoute } from "vue-router";
import LoginButton from "./components/LoginButton.vue";

const ERROR_MESSAGES: Record<string, string> = {
  not_a_member: "You are not a Northstar member on EU Ravencrest.",
  auth_failed: "Login failed. Please try again.",
  state_mismatch: "Login failed. Please try again.",
  api_error: "Could not reach the WoW API. Please try again later.",
};

export default defineComponent({
  name: "App",
  components: { LoginButton },
  setup() {
    const route = useRoute();
    const errorMessage = computed(() => {
      const err = route.query.error as string | undefined;
      return err ? ERROR_MESSAGES[err] ?? "An error occurred." : null;
    });
    return { errorMessage };
  },
});
</script>

<style lang="scss">
@use "./app.scss";

.top-nav {
  position: fixed;
  top: 16px;
  right: 20px;
  z-index: 100;
}

.auth-error {
  position: fixed;
  top: 60px;
  right: 20px;
  background: rgba(180, 30, 30, 0.9);
  color: #fff;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 0.85rem;
  z-index: 100;
}
</style>

