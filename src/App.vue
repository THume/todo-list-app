<script setup>
import { onUnmounted, ref, watch } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import AddTaskForm from './components/AddTaskForm.vue';
import TaskNotifications from './components/TaskNotifications.vue';
import { useTaskStore } from './stores/useTaskStore';

const { notifications, dismissNotification, teardown, tasks, addTask } = useTaskStore();

const showForm = ref(false);

const handleAddTask = (payload) => {
  addTask(payload);
};

watch(
  tasks,
  (value) => {
    if (Array.isArray(value) && value.length === 0) {
      showForm.value = true;
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  teardown();
});
</script>

<template>
  <TaskNotifications :notifications="notifications" @dismiss="dismissNotification" />
  <div class="layout">
    <aside class="layout__sidebar">
      <div class="layout__sidebar-top">
        <h1 class="layout__title">Todo List</h1>
        <nav class="layout__nav">
          <RouterLink to="/today" class="layout__link" active-class="layout__link--active"> Today </RouterLink>
          <RouterLink to="/all" class="layout__link" active-class="layout__link--active"> All Tasks </RouterLink>
          <RouterLink to="/completed" class="layout__link" active-class="layout__link--active"> Completed </RouterLink>
        </nav>
      </div>
      <AddTaskForm v-model:visible="showForm" class="layout__sidebar-form" @submit="handleAddTask" />
    </aside>
    <main class="layout__content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
$app-bg: #0f0f10;
$app-sidebar-bg: #161616;
$app-main-bg: #111112;
$app-border: #272727;
$app-text: #f4f4f5;
$app-muted: #a1a1aa;
$app-accent: #ef4444;

.layout {
  display: grid;
  grid-template-columns: minmax(16rem, 20rem) 1fr;
  color: $app-text;
  background: $app-bg;
  min-height: 100vh;
  box-sizing: border-box;
}

.layout__sidebar {
  background: $app-sidebar-bg;
  border-right: 1px solid $app-border;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  //justify-content: space-between;
  gap: 2.5rem;
  min-height: 100vh;
}

.layout__sidebar-top {
  display: grid;
  gap: 2rem;
}

.layout__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: $app-text;
}

.layout__nav {
  display: grid;
  gap: 0.75rem;
}

.layout__link {
  border: 1px solid transparent;
  border-radius: 0.75rem;
  padding: 0.55rem 0.9rem;
  color: $app-muted;
  text-decoration: none;
  font-weight: 600;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.layout__link:hover {
  color: $app-text;
  border-color: $app-border;
  background: rgba(255, 255, 255, 0.04);
  transform: translateX(2px);
}

.layout__link--active {
  border-color: $app-accent;
  background: $app-accent;
  color: #1b1b1d;
  box-shadow: 0 10px 25px -20px rgba(239, 68, 68, 0.9);
}

.layout__content {
  background: $app-main-bg;
  padding: 3rem clamp(1.5rem, 5vw, 3.5rem);
  display: block;
  min-height: 100vh;
  box-sizing: border-box;
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .layout__sidebar {
    position: sticky;
    top: 0;
    z-index: 1;
    border-right: none;
    border-bottom: 1px solid $app-border;
    padding: 1.5rem 1.5rem 1.75rem;
    gap: 1.5rem;
    min-height: auto;
  }

  .layout__sidebar-top {
    gap: 1.25rem;
  }

  .layout__nav {
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  .layout__link {
    text-align: center;
  }

  .layout__sidebar-form {
    margin-top: 1rem;
  }
}
</style>
