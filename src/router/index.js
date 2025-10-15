import { createRouter, createWebHistory } from 'vue-router';
import TodaysTasksView from '../views/TodaysTasksView.vue';
import AllTasksView from '../views/AllTasksView.vue';
import OverdueTasksView from '../views/OverdueTasksView.vue';
import CompletedTasksView from '../views/CompletedTasksView.vue';

const routes = [
  {
    path: '/',
    redirect: '/today',
  },
  {
    path: '/overdue',
    component: OverdueTasksView,
  },
  {
    path: '/today',
    component: TodaysTasksView,
  },
  {
    path: '/all',
    component: AllTasksView,
  },
  {
    path: '/completed',
    component: CompletedTasksView,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
