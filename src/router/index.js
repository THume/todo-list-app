import { createRouter, createWebHistory } from 'vue-router';
import TodaysTasksView from '../views/TodaysTasksView.vue';
import TomorrowsTasksView from '../views/TomorrowsTasksView.vue';
import AllTasksView from '../views/AllTasksView.vue';
import TaskListView from '../views/TaskListView.vue';
import OverdueTasksView from '../views/OverdueTasksView.vue';
import CompletedTasksView from '../views/CompletedTasksView.vue';

const routes = [
  {
    path: '/',
    redirect: '/today',
  },
  {
    path: '/today',
    component: TodaysTasksView,
  },
  {
    path: '/tomorrow',
    component: TomorrowsTasksView,
  },
  {
    path: '/lists/:id',
    component: TaskListView,
  },
  {
    path: '/overdue',
    component: OverdueTasksView,
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
