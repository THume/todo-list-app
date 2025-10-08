<script setup>
import { ref, watch } from 'vue';
import Task from '../components/Task.vue';
import AddTaskForm from '../components/AddTaskForm.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  tasks,
  addTask,
  toggleTaskCompletion,
  removeTask,
} = useTaskStore();

const showForm = ref(tasks.value.length === 0);
const showDeleteDialog = ref(false);
const taskPendingDelete = ref(null);

const handleAdd = (payload) => {
  addTask(payload);
};

const handleToggle = (task) => {
  toggleTaskCompletion(task.id);
};

const requestDelete = (task) => {
  taskPendingDelete.value = task;
  showDeleteDialog.value = true;
};

const closeDialog = () => {
  showDeleteDialog.value = false;
  taskPendingDelete.value = null;
};

const confirmDelete = () => {
  if (taskPendingDelete.value) {
    removeTask(taskPendingDelete.value.id);
  }
  closeDialog();
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
</script>

<template>
  <section class="task-panel">
    <header class="task-panel__header">
      <h2>All Tasks</h2>
      <span class="task-panel__count">{{ tasks.length }} total</span>
    </header>
    <p v-if="tasks.length === 0" class="task-panel__empty">
      No tasks yet - add your first task below.
    </p>
    <ul v-else class="task-panel__list">
      <li v-for="task in tasks" :key="task.id" class="task-panel__item">
        <Task :task="task" @toggle="handleToggle" @remove="requestDelete" />
      </li>
    </ul>
  </section>

  <AddTaskForm v-model:visible="showForm" @submit="handleAdd" />

  <ConfirmDialog
    v-model:open="showDeleteDialog"
    title="Delete task?"
    confirm-label="Delete"
    cancel-label="Cancel"
    :item-label="taskPendingDelete?.title || ''"
    @confirm="confirmDelete"
    @cancel="closeDialog"
  />
</template>

<style scoped lang="scss">
.task-panel {
  border: 1px solid rgba(39, 52, 73, 0.45);
  border-radius: 1rem;
  padding: 1.25rem;
  background: rgba(15, 23, 42, 0.35);
  box-shadow: 0 18px 32px -28px rgba(15, 23, 42, 0.9);
  display: grid;
  gap: 1rem;

  @media (max-width: 640px) {
    padding: 1rem;
  }
}

.task-panel__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
}

.task-panel__count {
  color: #94a3b8;
  font-size: 0.95rem;
}

.task-panel__empty {
  margin: 0;
  padding: 1.5rem;
  border: 2px dashed rgba(39, 52, 73, 0.6);
  border-radius: 1rem;
  color: #94a3b8;
  text-align: center;
  background: rgba(15, 23, 42, 0.25);
}

.task-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}

.task-panel__item {
  list-style: none;
}
</style>
