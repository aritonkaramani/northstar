import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/members',
    component: () => import('../views/MembersArea.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        component: () => import('../views/MembersHome.vue'),
      },
      {
        path: 'roster',
        component: () => import('../views/RosterView.vue'),
      },
      {
        path: 'absence',
        component: () => import('../views/AbsenceView.vue'),
      },
      {
        path: 'sims',
        component: () => import('../views/SimsView.vue'),
      },
      {
        path: 'clips',
        component: () => import('../views/ClipsView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const { ready, user } = useAuth();
    await ready;
    if (!user.value) return '/';
  }
});

export default router;
