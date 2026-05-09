<template>
  <div class="login-button" v-if="!loading">
    <template v-if="user">
      <span class="battletag">{{ user.battleTag }}</span>
      <button class="btn btn-logout" @click="logout">Logout</button>
    </template>
    <template v-else>
      <a class="btn btn-login" href="/api/auth/login">
        Login with Battle.net
      </a>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useAuth } from '../composables/useAuth';

export default defineComponent({
  name: 'LoginButton',
  setup() {
    const { user, loading, logout } = useAuth();
    return { user, loading, logout };
  },
});
</script>

<style lang="scss" scoped>
.login-button {
  display: flex;
  align-items: center;
  gap: 10px;
}

.battletag {
  color: #e2b84b;
  font-size: 0.9rem;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  text-decoration: none;
  border: none;
  font-family: inherit;
}

.btn-login {
  background: #0074e0;
  color: #fff;

  &:hover {
    background: #005bb5;
  }

  .bnet-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }
}

.btn-logout {
  background: transparent;
  color: #888;
  border: 1px solid #333;

  &:hover {
    color: #e2b84b;
    border-color: #e2b84b;
  }
}
</style>
