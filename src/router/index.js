import { createRouter, createWebHistory } from 'vue-router';
import TodaysTasksView from '../views/TodaysTasksView.vue';
import TomorrowsTasksView from '../views/TomorrowsTasksView.vue';
import AllTasksView from '../views/AllTasksView.vue';
import TaskListView from '../views/TaskListView.vue';
import OverdueTasksView from '../views/OverdueTasksView.vue';
import CompletedTasksView from '../views/CompletedTasksView.vue';
import StandupView from '../views/StandupView.vue';
import SummaryView from '../views/SummaryView.vue';
import ActiveGoalsView from '../views/ActiveGoalsView.vue';
import GoalOutcomesView from '../views/GoalOutcomesView.vue';
import GoalMetricsView from '../views/GoalMetricsView.vue';
import SettingsView from '../views/SettingsView.vue';

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
    path: '/lists/:name',
    component: TaskListView,
  },
  {
    path: '/overdue',
    component: OverdueTasksView,
  },
  {
    path: '/standup',
    component: StandupView,
  },
  {
    path: '/summary',
    component: SummaryView,
  },
  {
    path: '/goals',
    redirect: '/goals/active',
  },
  {
    path: '/goals/active',
    component: ActiveGoalsView,
  },
  {
    path: '/goals/metrics',
    component: GoalMetricsView,
  },
  {
    path: '/goals/outcomes',
    component: GoalOutcomesView,
  },
  {
    path: '/all',
    component: AllTasksView,
  },
  {
    path: '/completed',
    component: CompletedTasksView,
  },
  {
    path: '/settings',
    component: SettingsView,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
