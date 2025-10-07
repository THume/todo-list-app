<script setup>
import { ref, onMounted, watch } from 'vue';
import Task from './components/Task.vue';
import AddTaskForm from './components/AddTaskForm.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';

const STORAGE_KEY = 'todo-list-app/tasks';

let initialId = 1;

const tasks = ref([]);
const showForm = ref(true);
const showDeleteDialog = ref(false);
const taskPendingDelete = ref(null);

const persistTasks = (value) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to persist tasks to localStorage', error);
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

  syncInitialId();
  showForm.value = tasks.value.length === 0;

  watch(
    tasks,
    (value) => {
      persistTasks(value);
    },
    { deep: true }
  );

  persistTasks(tasks.value);
});
</script>

<template>
  <main class="app">
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
</style>
