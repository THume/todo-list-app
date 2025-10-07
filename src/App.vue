<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import Task from './components/Task.vue';
import AddTaskForm from './components/AddTaskForm.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import TaskNotifications from './components/TaskNotifications.vue';
import { useTaskNotifications } from './composables/useTaskNotifications';

const STORAGE_KEY = 'todo-list-app/tasks';
const COMPLETED_STORAGE_KEY = 'todo-list-app/completed-tasks';

let initialId = 1;

const tasks = ref([]);
const completedTasks = ref([]);
const showForm = ref(true);
const showDeleteDialog = ref(false);
const taskPendingDelete = ref(null);

const {
  notifications,
  dismissNotification,
  startDueWatcher,
  stopDueWatcher,
  checkDueTasks,
} = useTaskNotifications(tasks);

const persistTasks = (value) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to persist tasks to localStorage', error);
  }
};

const persistCompletedTasks = (value) => {
  try {
    window.localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to persist completed tasks', error);
  }
};

const syncInitialId = () => {
  const maxId = tasks.value.reduce((acc, task) => Math.max(acc, Number(task.id) || 0), 0);
  initialId = maxId + 1;
};

const buildDueDate = (date, time) => {
  if (!date) {
    return null;
  }

  const normalizedTime = time && time.trim().length > 0 ? time : '00:00';
  const timestamp = new Date(`${date}T${normalizedTime}`);

  if (Number.isNaN(timestamp.valueOf())) {
    return null;
  }

  return timestamp.toISOString();
};

const formatTimestamp = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const recordCompletion = (task) => {
  if (!task) {
    return;
  }

  const entry = {
    taskId: task.id,
    title: task.title,
    description: task.description ?? '',
    due: task.due ?? null,
    completedAt: new Date().toISOString(),
  };

  const existingIndex = completedTasks.value.findIndex((item) => item.taskId === task.id);

  if (existingIndex >= 0) {
    const updated = [...completedTasks.value];
    updated[existingIndex] = entry;
    completedTasks.value = updated;
  } else {
    completedTasks.value = [...completedTasks.value, entry];
  }
};

const isToday = (date) => {
  if (!(date instanceof Date)) {
    return false;
  }

  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
};

const tasksDueToday = computed(() => {
  if (!Array.isArray(tasks.value)) {
    return [];
  }

  return tasks.value.filter((task) => {
    if (!task || task.completed || !task.due) {
      return false;
    }

    const dueDate = new Date(task.due);
    return !Number.isNaN(dueDate.getTime()) && isToday(dueDate);
  });
});

const sortedCompletedTasks = computed(() => {
  return [...completedTasks.value].sort((a, b) => {
    const aTime = Date.parse(a.completedAt ?? '');
    const bTime = Date.parse(b.completedAt ?? '');

    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return 0;
    }

    return bTime - aTime;
  });
});

const handleAddTask = ({ title, description, dueDate, dueTime }) => {
  if (!title) {
    return;
  }

  tasks.value.push({
    id: initialId++,
    title,
    description,
    completed: false,
    due: buildDueDate(dueDate, dueTime),
  });
};

const toggleTask = (task) => {
  const target = tasks.value.find((item) => item.id === task.id);
  if (target) {
    target.completed = !target.completed;
    if (target.completed) {
      recordCompletion(target);
    }
  }
};

const requestDeleteTask = (task) => {
  taskPendingDelete.value = task;
  showDeleteDialog.value = true;
};

const closeDeleteDialog = () => {
  showDeleteDialog.value = false;
  taskPendingDelete.value = null;
};

const confirmDeleteTask = () => {
  if (!taskPendingDelete.value) {
    return;
  }

  const idToRemove = taskPendingDelete.value.id;
  tasks.value = tasks.value.filter((item) => item.id !== idToRemove);
  closeDeleteDialog();

  if (tasks.value.length === 0) {
    showForm.value = true;
  }
};

watch(
  tasks,
  () => {
    persistTasks(tasks.value);
    checkDueTasks();
  },
  { deep: true }
);

watch(
  completedTasks,
  () => {
    persistCompletedTasks(completedTasks.value);
  },
  { deep: true }
);

onMounted(() => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        tasks.value = parsed.map((task, index) => ({
          id: task.id ?? index + 1,
          title: typeof task.title === 'string' ? task.title : 'Untitled task',
          description: typeof task.description === 'string' ? task.description : '',
          completed: Boolean(task.completed),
          due: task.due ?? null,
        }));
      }
    }
  } catch (error) {
    console.error('Failed to load tasks from localStorage', error);
    tasks.value = [];
  }

  try {
    const completedRaw = window.localStorage.getItem(COMPLETED_STORAGE_KEY);
    if (completedRaw) {
      const parsedCompleted = JSON.parse(completedRaw);

      if (Array.isArray(parsedCompleted)) {
        completedTasks.value = parsedCompleted.map((entry) => ({
          taskId: entry.taskId,
          title: entry.title ?? 'Untitled task',
          description: entry.description ?? '',
          due: entry.due ?? null,
          completedAt: entry.completedAt ?? new Date().toISOString(),
        }));
      }
    }
  } catch (error) {
    console.error('Failed to load completed tasks', error);
    completedTasks.value = [];
  }

  syncInitialId();
  showForm.value = tasks.value.length === 0;
  persistTasks(tasks.value);
  persistCompletedTasks(completedTasks.value);

  tasks.value.forEach((task) => {
    if (task.completed && !completedTasks.value.some((entry) => entry.taskId === task.id)) {
      recordCompletion(task);
    }
  });

  checkDueTasks();
  startDueWatcher();
});

onUnmounted(() => {
  stopDueWatcher();
});
</script>

<template>
  <TaskNotifications
    :notifications="notifications"
    @dismiss="dismissNotification"
  />
  <main class="app">
    <section class="task-list task-list--today">
      <header class="task-list__header">
        <h2>Due Today</h2>
        <span class="task-list__count">{{ tasksDueToday.length }} due</span>
      </header>
      <p v-if="tasksDueToday.length === 0" class="task-list__empty">
        No tasks are due today.
      </p>
      <ul v-else class="task-list__items">
        <li v-for="task in tasksDueToday" :key="`today-${task.id}`" class="task-list__item">
          <Task :task="task" @toggle="toggleTask" @remove="requestDeleteTask" />
        </li>
      </ul>
    </section>
    <section class="task-list">
      <header class="task-list__header">
        <h2>Tasks</h2>
        <span class="task-list__count">{{ tasks.length }} total</span>
      </header>
      <p v-if="tasks.length === 0" class="task-list__empty">
        No tasks yet - open the form below to add your first task.
      </p>
      <ul v-else class="task-list__items">
        <li v-for="task in tasks" :key="task.id" class="task-list__item">
          <Task :task="task" @toggle="toggleTask" @remove="requestDeleteTask" />
        </li>
      </ul>
    </section>

    <AddTaskForm v-model:visible="showForm" @submit="handleAddTask" />

    <section class="history">
      <header class="history__header">
        <h2>Completed Tasks</h2>
        <span class="history__count">{{ sortedCompletedTasks.length }} saved</span>
      </header>
      <p v-if="sortedCompletedTasks.length === 0" class="history__empty">
        No completed tasks yet. Finish a task to see it here.
      </p>
      <ul v-else class="history__list">
        <li
          v-for="entry in sortedCompletedTasks"
          :key="`completed-${entry.taskId}`"
          class="history__item"
        >
          <div class="history__item-header">
            <span class="history__title">{{ entry.title }}</span>
            <time class="history__timestamp" :datetime="entry.completedAt">
              Completed {{ formatTimestamp(entry.completedAt) }}
            </time>
          </div>
          <p v-if="entry.description" class="history__description">
            {{ entry.description }}
          </p>
          <time
            v-if="entry.due"
            class="history__due"
            :datetime="entry.due"
          >
            Original due: {{ formatTimestamp(entry.due) }}
          </time>
        </li>
      </ul>
    </section>
  </main>
  <ConfirmDialog
    v-model:open="showDeleteDialog"
    title="Delete task?"
    confirm-label="Delete"
    cancel-label="Cancel"
    :item-label="taskPendingDelete?.title || ''"
    @confirm="confirmDeleteTask"
    @cancel="closeDeleteDialog"
  />
</template>

<style scoped lang="scss">
$app-bg: linear-gradient(180deg, #0f172a 0%, #020617 60%);
$app-text: #e2e8f0;
$input-border: #273449;
$input-text: #f8fafc;
$muted-text: #94a3b8;

.app {
  max-width: 48rem;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 3.5rem;
  display: grid;
  gap: 2.5rem;
  color: $app-text;
  background: $app-bg;
  min-height: 100vh;
  box-sizing: border-box;

  @media (max-width: 640px) {
    padding: 1.5rem 1rem 2.5rem;
    gap: 2rem;
  }
}

.task-list {
  display: grid;
  gap: 1rem;

  &--today {
    border: 1px solid rgba(39, 52, 73, 0.45);
    border-radius: 1rem;
    padding: 1.25rem;
    background: rgba(15, 23, 42, 0.4);
    box-shadow: 0 18px 28px -26px rgba(15, 23, 42, 0.8);

    @media (max-width: 640px) {
      padding: 1rem;
    }
  }

  &__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;

    h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: $input-text;
    }
  }

  &__count {
    color: $muted-text;
    font-size: 0.95rem;
  }

  &__empty {
    margin: 0;
    padding: 1.5rem;
    border: 2px dashed $input-border;
    border-radius: 1rem;
    color: $muted-text;
    text-align: center;
    background: rgba(15, 23, 42, 0.35);
  }

  &__items {
    list-style: none;
    display: grid;
    gap: 1rem;
    padding: 0;
    margin: 0;
  }

  &__item {
    list-style: none;
  }
}

.history {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid rgba(39, 52, 73, 0.45);
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.35);
  box-shadow: 0 18px 32px -28px rgba(15, 23, 42, 0.9);

  @media (max-width: 640px) {
    padding: 1rem;
  }

  &__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  &__count {
    color: $muted-text;
    font-size: 0.95rem;
  }

  &__empty {
    margin: 0;
    padding: 1rem 0;
    color: $muted-text;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1rem;
  }

  &__item {
    border: 1px solid rgba(39, 52, 73, 0.45);
    border-radius: 0.75rem;
    padding: 0.85rem 1rem;
    background: rgba(15, 23, 42, 0.65);
    display: grid;
    gap: 0.5rem;
  }

  &__item-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__title {
    font-weight: 600;
    color: $input-text;
  }

  &__timestamp {
    color: $muted-text;
    font-size: 0.85rem;
  }

  &__description {
    margin: 0;
    color: $input-text;
    opacity: 0.85;
  }

  &__due {
    color: #38bdf8;
    font-size: 0.85rem;
  }
}
</style>
