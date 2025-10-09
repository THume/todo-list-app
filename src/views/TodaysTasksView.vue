<script setup>
import { ref, watch } from 'vue';
import Task from '../components/Task.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import TaskEditorDialog from '../components/TaskEditorDialog.vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  tasksDueToday,
  toggleTaskCompletion,
  removeTask,
  updateTask,
} = useTaskStore();

const showDeleteDialog = ref(false);
const taskPendingDelete = ref(null);
const showEditDialog = ref(false);
const taskPendingEdit = ref(null);

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

const startEdit = (task) => {
  taskPendingEdit.value = task;
  showEditDialog.value = true;
};

const closeEdit = () => {
  showEditDialog.value = false;
};

const handleEditSave = (payload) => {
  updateTask(payload);
  closeEdit();
};

watch(showEditDialog, (isOpen) => {
  if (!isOpen) {
    taskPendingEdit.value = null;
  }
});
</script>

<template>
  <section class="task-panel">
    <header class="task-panel__header">
      <h2>Due Today</h2>
      <span class="task-panel__count">{{ tasksDueToday.length }} due</span>
    </header>
    <p v-if="tasksDueToday.length === 0" class="task-panel__empty">
      No tasks are due today.
    </p>
    <ul v-else class="task-panel__list">
      <li v-for="task in tasksDueToday" :key="task.id" class="task-panel__item">
        <Task
          :task="task"
          @toggle="handleToggle"
          @remove="requestDelete"
          @edit="startEdit"
        />
      </li>
    </ul>
  </section>
  <ConfirmDialog
    v-model:open="showDeleteDialog"
    title="Delete task?"
    confirm-label="Delete"
    cancel-label="Cancel"
    :item-label="taskPendingDelete?.title || ''"
    @confirm="confirmDelete"
    @cancel="closeDialog"
  />
  <TaskEditorDialog
    v-model:open="showEditDialog"
    :task="taskPendingEdit"
    @save="handleEditSave"
    @cancel="closeEdit"
  />
</template>

<style scoped lang="scss">
.task-panel {
  border: 1px solid #262626;
  border-radius: 1rem;
  padding: 1.25rem;
  background: rgba(23, 23, 24, 0.6);
  box-shadow: 0 18px 28px -26px rgba(0, 0, 0, 0.85);
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
  color: #a1a1aa;
  font-size: 0.95rem;
}

.task-panel__empty {
  margin: 0;
  padding: 1.5rem;
  border: 2px dashed #2f2f2f;
  border-radius: 1rem;
  color: #a1a1aa;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
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
