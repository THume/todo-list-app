<script setup>
import { onUnmounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import TaskNotifications from './components/TaskNotifications.vue';
import { useTaskStore } from './stores/useTaskStore';

const {
  notifications,
  dismissNotification,
  teardown,
} = useTaskStore();

onUnmounted(() => {
  teardown();
});
</script>

<template>
  <TaskNotifications
    :notifications="notifications"
    @dismiss="dismissNotification"
  />
  <div class="layout">
    <header class="layout__header">
      <h1 class="layout__title">Todo List</h1>
      <nav class="layout__nav">
        <RouterLink to="/today" class="layout__link" active-class="layout__link--active">
          Today
        </RouterLink>
        <RouterLink to="/all" class="layout__link" active-class="layout__link--active">
          All Tasks
        </RouterLink>
        <RouterLink to="/completed" class="layout__link" active-class="layout__link--active">
          Completed
        </RouterLink>
      </nav>
    </header>
    <main class="layout__content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
$app-bg: linear-gradient(180deg, #0f172a 0%, #020617 60%);
$app-text: #e2e8f0;

.layout {
  max-width: 60rem;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 3.5rem;
  display: grid;
  gap: 2rem;
  color: $app-text;
  background: $app-bg;
  min-height: 100vh;
  box-sizing: border-box;

  @media (max-width: 640px) {
    padding: 1.5rem 1rem 2.5rem;
    gap: 1.5rem;
  }
}

.layout__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.layout__title {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 700;
}

.layout__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.layout__link {
  border: 1px solid rgba(39, 52, 73, 0.6);
  border-radius: 999px;
  padding: 0.4rem 1.1rem;
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.layout__link:hover {
  border-color: #38bdf8;
  color: #38bdf8;
}

.layout__link--active {
  border-color: transparent;
  background: linear-gradient(135deg, #22d3ee, #0ea5e9);
  color: #0f172a;
}

.layout__content {
  display: grid;
}
</style>
