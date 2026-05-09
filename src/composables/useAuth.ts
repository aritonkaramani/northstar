import { ref } from 'vue';

interface User {
  battleTag: string;
  verified: boolean;
}

const user = ref<User | null>(null);
const loading = ref(true);

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

// Hydrate auth state once on app load
fetchUser();

export function useAuth() {
  return { user, loading, logout, fetchUser };
}
