import { ref } from 'vue';

interface User {
  id: string | null;
  battleTag: string;
  verified: boolean;
}

const user = ref<User | null>(null);
const loading = ref(true);

// Resolves once the initial auth check completes — used by the router guard
const ready: Promise<void> = (async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    user.value = res.ok ? await res.json() : null;
  } catch {
    user.value = null;
  } finally {
    loading.value = false;
  }
})();

async function fetchUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    user.value = res.ok ? await res.json() : null;
  } catch {
    user.value = null;
  } finally {
    loading.value = false;
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  user.value = null;
}

export function useAuth() {
  return { user, loading, ready, logout, fetchUser };
}
