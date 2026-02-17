<script setup>
import { computed, ref, watch } from 'vue';
import Task from '../components/Task.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import AddEditTaskModal from '../components/AddEditTaskModal.vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  tasks,
  tasksOverdue,
  toggleTaskCompletion,
  removeTask,
  updateTask,
  reorderTask,
  duplicateTask,
  addTask,
  toggleSubtaskCompletion,
  moveTaskToToday,
  moveTaskToTomorrow,
  moveOverdueTasksToToday,
  markTaskWorkedOn,
  markLongTermTaskWorkedOn,
  lists,
  skipTaskRecurrence,
} = useTaskStore();

const showDeleteDialog = ref(false);
const taskPendingDelete = ref(null);
const showEditDialog = ref(false);
const taskPendingEdit = ref(null);
const showDuplicateDialog = ref(false);
const taskPendingDuplicate = ref(null);
const draggedTaskId = ref(null);
const dragOverTaskId = ref(null);
const dropIndicatorIndex = ref(-1);

const listNameById = computed(() => {
  const result = {};
  const available = Array.isArray(lists.value) ? lists.value : [];
  available.forEach((list) => {
    if (list && typeof list.id === 'string') {
      result[list.id] = typeof list.name === 'string' && list.name.trim().length > 0
        ? list.name.trim()
        : 'My Tasks';
    }
  });
  return result;
});

const resolveListName = (task) => {
  if (!task) {
    return listNameById.value.default ?? 'My Tasks';
  }
  const listId = typeof task.listId === 'string' ? task.listId : '';
  const fallback = listNameById.value.default ?? 'My Tasks';
  if (listId && listNameById.value[listId]) {
    return listNameById.value[listId];
  }
  return fallback;
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

const handleDuplicate = (task) => {
  taskPendingDuplicate.value = task;
  showDuplicateDialog.value = true;
};

const closeDuplicate = () => {
  showDuplicateDialog.value = false;
};

const handleDuplicateSubmit = (payload) => {
  addTask(payload);
  closeDuplicate();
};

const handleMoveToToday = (task) => {
  moveTaskToToday(task.id);
};

const handleMoveToTomorrow = (task) => {
  moveTaskToTomorrow(task.id);
};

const handleWorkedOnNextDay = (task) => {
  markTaskWorkedOn(task.id, { dayOffset: 2 });
};

const handleLongTermWorkedOn = (task) => {
  markLongTermTaskWorkedOn(task.id);
};

const getWorkedOnActionLabel = (task) => {
  if (!task) {
    return '';
  }
  if (task.recurrence) {
    return 'Mark as "Worked on" and move to next occurrence';
  }
  return 'Mark as "Worked on" and move to next day';
};

const handleToggleSubtask = ({ taskId, subtaskId }) => {
  toggleSubtaskCompletion(taskId, subtaskId);
};

const handleMoveAllToToday = () => {
  if (!tasksOverdue.value?.length) {
    return;
  }
  moveOverdueTasksToToday();
};

const handleSkipRecurrence = (task) => {
  if (!task?.id) {
    return;
  }
  skipTaskRecurrence(task.id);
};

const handleDragStart = (task) => {
  draggedTaskId.value = task.id;
};

const handleDragEnd = () => {
  draggedTaskId.value = null;
  dragOverTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleDragEnter = (task) => {
  if (!draggedTaskId.value || draggedTaskId.value === task.id) {
    return;
  }

  const allTasks = tasks.value ?? [];
  const overdueList = tasksOverdue.value ?? [];
  const sourceIndexAll = allTasks.findIndex((item) => item.id === draggedTaskId.value);
  const targetIndexAll = allTasks.findIndex((item) => item.id === task.id);

  if (sourceIndexAll < 0 || targetIndexAll < 0) {
    dropIndicatorIndex.value = -1;
    return;
  }

  const targetIndexOverdue = overdueList.findIndex((item) => item.id === task.id);
  const sourceIndexOverdue = overdueList.findIndex((item) => item.id === draggedTaskId.value);

  let indicatorIndex = targetIndexOverdue >= 0 ? targetIndexOverdue : 0;

  if (sourceIndexAll < targetIndexAll) {
    indicatorIndex = targetIndexOverdue >= 0 ? targetIndexOverdue + 1 : overdueList.length;
  } else if (sourceIndexOverdue >= 0 && targetIndexOverdue >= 0) {
    indicatorIndex = targetIndexOverdue;
  }

  dropIndicatorIndex.value = indicatorIndex;
  dragOverTaskId.value = task.id;
};

const handleDragLeave = (task) => {
  if (dragOverTaskId.value === task.id) {
    dragOverTaskId.value = null;
    dropIndicatorIndex.value = -1;
  }
};

const handleDrop = (task) => {
  if (!draggedTaskId.value || draggedTaskId.value === task.id) {
    dragOverTaskId.value = null;
    dropIndicatorIndex.value = -1;
    return;
  }

  const allTasks = tasks.value ?? [];
  const sourceIndex = allTasks.findIndex((item) => item.id === draggedTaskId.value);
  const targetIndex = allTasks.findIndex((item) => item.id === task.id);

  if (sourceIndex < 0 || targetIndex < 0) {
    dragOverTaskId.value = null;
    dropIndicatorIndex.value = -1;
    return;
  }

  let beforeId = task.id;
  if (sourceIndex < targetIndex) {
    const nextItem = allTasks[targetIndex + 1];
    beforeId = nextItem ? nextItem.id : null;
  }

  reorderTask({
    id: draggedTaskId.value,
    beforeId,
  });

  dragOverTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleDropAtListEnd = () => {
  if (!draggedTaskId.value) {
    return;
  }

  reorderTask({
    id: draggedTaskId.value,
    beforeId: null,
  });

  dragOverTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleListDragOver = (event) => {
  if (!draggedTaskId.value) {
    return;
  }
  if (event?.target !== event?.currentTarget) {
    return;
  }
  dropIndicatorIndex.value = (tasksOverdue.value ?? []).length;
  dragOverTaskId.value = null;
};

watch(showEditDialog, (isOpen) => {
  if (!isOpen) {
    taskPendingEdit.value = null;
  }
});

watch(showDuplicateDialog, (isOpen) => {
  if (!isOpen) {
    taskPendingDuplicate.value = null;
  }
});
</script>

<template>
  <section class="task-panel">
    <header class="task-panel__header">
      <h2>Overdue</h2>
      <div class="task-panel__actions">
        <button
          type="button"
          class="task-panel__action"
          :disabled="tasksOverdue.length === 0"
          @click="handleMoveAllToToday"
        >
          Move all to Today
        </button>
        <span class="task-panel__count">{{ tasksOverdue.length }} overdue</span>
      </div>
    </header>
    <p v-if="tasksOverdue.length === 0" class="task-panel__empty">
      All caught up—no overdue tasks from previous days.
    </p>
    <ul
      v-else
      class="task-panel__list"
      @dragover.prevent="handleListDragOver($event)"
      @drop.prevent="handleDropAtListEnd"
    >
      <template v-for="(task, index) in tasksOverdue" :key="task.id">
        <li
          v-if="dropIndicatorIndex === index"
          class="task-panel__drop-indicator"
        />
        <li
          class="task-panel__item"
          :class="{
            'task-panel__item--drag-over': dragOverTaskId === task.id,
            'task-panel__item--dragging': draggedTaskId === task.id,
          }"
          :draggable="!task.completed"
          @dragstart="handleDragStart(task)"
          @dragend="handleDragEnd"
          @dragenter.prevent="handleDragEnter(task)"
          @dragover.prevent
          @dragleave="handleDragLeave(task)"
          @drop.prevent.stop="handleDrop(task)"
        >
          <Task
            :task="task"
            :list-name="resolveListName(task)"
            show-skip-recurrence-action
            :show-worked-on-action="Boolean(getWorkedOnActionLabel(task))"
            :worked-on-action-label="getWorkedOnActionLabel(task)"
            @toggle="handleToggle"
            @remove="requestDelete"
            @edit="startEdit"
            @duplicate="handleDuplicate"
            @move-to-today="handleMoveToToday"
            @move-to-tomorrow="handleMoveToTomorrow"
            @worked-on="handleWorkedOnNextDay"
            @long-term-worked-on="handleLongTermWorkedOn"
            @skip-recurrence="handleSkipRecurrence"
            @toggle-subtask="handleToggleSubtask"
          />
        </li>
      </template>
      <li
        v-if="dropIndicatorIndex === tasksOverdue.length"
        class="task-panel__drop-indicator task-panel__drop-indicator--end"
      />
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
  <AddEditTaskModal
    v-model:visible="showEditDialog"
    mode="edit"
    :task="taskPendingEdit"
    :lists="lists"
    @save="handleEditSave"
    @cancel="closeEdit"
  />
  <AddEditTaskModal
    v-model:visible="showDuplicateDialog"
    mode="duplicate"
    :task="taskPendingDuplicate"
    :lists="lists"
    @submit="handleDuplicateSubmit"
    @cancel="closeDuplicate"
  />
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.task-panel {
  border: 1px solid theme.$color-border-strong;
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

.task-panel__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.task-panel__action {
  border: 1px solid theme.$color-border-input;
  background: rgba(239, 68, 68, 0.15);
  color: theme.$color-text-primary;
  font-weight: 700;
  font-size: 0.95rem;
  padding: 0.5rem 1rem;
  border-radius: 0.8rem;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 12px 22px -20px rgba(239, 68, 68, 0.7);

  &:hover:enabled {
    background: rgba(239, 68, 68, 0.25);
    border-color: theme.$color-accent;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
  }
}

.task-panel__count {
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.task-panel__empty {
  margin: 0;
  padding: 1.5rem;
  border: 2px dashed theme.$color-border-input;
  border-radius: 1rem;
  color: theme.$color-text-muted;
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

.task-panel__item--drag-over {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.task-panel__item--dragging {
  opacity: 0.6;
}

.task-panel__drop-indicator {
  height: 0;
  border-top: 2px dashed theme.$color-accent;
  margin: 0.25rem 0;
}

.task-panel__drop-indicator--end {
  margin-bottom: 0;
}
</style>
