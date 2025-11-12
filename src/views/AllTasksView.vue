<script setup>
import { computed, ref, watch } from 'vue';
import Task from '../components/Task.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import TaskEditorDialog from '../components/TaskEditorDialog.vue';
import IconGlyph from '../components/IconGlyph.vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  tasks,
  activeTasks,
  toggleTaskCompletion,
  removeTask,
  updateTask,
  reorderTask,
  duplicateTask,
  moveTaskToToday,
  moveTaskToTomorrow,
  postponeTasksUntil,
  lists,
} = useTaskStore();

const showDeleteDialog = ref(false);
const taskPendingDelete = ref(null);
const showEditDialog = ref(false);
const taskPendingEdit = ref(null);
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
  if (task.completed) {
    return;
  }
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
  const duplicated = duplicateTask(task.id);
  if (duplicated) {
    startEdit(duplicated);
  }
};

const handleMoveToToday = (task) => {
  moveTaskToToday(task.id);
};

const handleMoveToTomorrow = (task) => {
  moveTaskToTomorrow(task.id);
};

const postponeDate = ref('');
const postponeMessage = ref('');
const postponeMessageType = ref('info');
const isPostponePending = ref(false);

const canPostpone = computed(() => typeof postponeDate.value === 'string' && postponeDate.value.length > 0);

const todayIso = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});

const formatPostponeDate = (value) => {
  if (!value) {
    return '';
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed);
};

const resetPostponeMessage = () => {
  postponeMessage.value = '';
  postponeMessageType.value = 'info';
};

watch(postponeDate, () => {
  resetPostponeMessage();
});

const handlePostponeAll = () => {
  if (isPostponePending.value) {
    return;
  }
  if (!canPostpone.value) {
    postponeMessage.value = 'Select a date to postpone tasks.';
    postponeMessageType.value = 'error';
    return;
  }

  isPostponePending.value = true;
  try {
    const { updatedCount } = postponeTasksUntil(postponeDate.value);
    if (updatedCount > 0) {
      postponeMessage.value = `Moved ${updatedCount} task${updatedCount === 1 ? '' : 's'} to ${formatPostponeDate(
        postponeDate.value
      )}.`;
      postponeMessageType.value = 'success';
    } else {
      postponeMessage.value = 'No tasks were due before the selected date.';
      postponeMessageType.value = 'info';
    }
  } finally {
    isPostponePending.value = false;
  }
};

const handleDragStart = (task) => {
  if (task.completed) {
    return;
  }
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
  const visibleTasks = activeTasks.value ?? [];
  const sourceIndex = allTasks.findIndex((item) => item.id === draggedTaskId.value);
  const targetIndex = allTasks.findIndex((item) => item.id === task.id);

  if (sourceIndex < 0 || targetIndex < 0) {
    dropIndicatorIndex.value = -1;
    return;
  }

  const targetIndexVisible = visibleTasks.findIndex((item) => item.id === task.id);
  const sourceIndexVisible = visibleTasks.findIndex((item) => item.id === draggedTaskId.value);

  let indicatorIndex = targetIndexVisible >= 0 ? targetIndexVisible : 0;

  if (sourceIndex < targetIndex) {
    indicatorIndex = targetIndexVisible >= 0 ? targetIndexVisible + 1 : visibleTasks.length;
  } else if (sourceIndexVisible >= 0 && targetIndexVisible >= 0) {
    indicatorIndex = targetIndexVisible;
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
  draggedTaskId.value = null;
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
  draggedTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleListDragOver = (event) => {
  if (!draggedTaskId.value) {
    return;
  }
  if (event?.target !== event?.currentTarget) {
    return;
  }
  dropIndicatorIndex.value = (activeTasks.value ?? []).length;
  dragOverTaskId.value = null;
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
      <h2>All Tasks</h2>
      <span class="task-panel__count">{{ activeTasks.length }} active</span>
    </header>
    <div class="task-panel__controls">
      <div class="postpone-control">
        <label class="postpone-control__label" for="postpone-date-input">
          <IconGlyph
            name="calendar"
            size="16"
            class="postpone-control__label-icon"
            aria-hidden="true"
          />
          Postpone tasks until
        </label>
        <div class="postpone-control__inputs">
          <input
            id="postpone-date-input"
            v-model="postponeDate"
            type="date"
            class="postpone-control__date"
            :min="todayIso"
            name="postpone-date"
          />
          <button
            type="button"
            class="postpone-control__button"
            :disabled="!canPostpone || isPostponePending"
            @click="handlePostponeAll"
          >
            <IconGlyph
              name="repeat"
              size="16"
              class="postpone-control__button-icon"
              aria-hidden="true"
            />
            {{ isPostponePending ? 'Postponing...' : 'Postpone' }}
          </button>
        </div>
      </div>
      <p
        v-if="postponeMessage"
        class="postpone-control__status"
        :class="`postpone-control__status--${postponeMessageType}`"
      >
        {{ postponeMessage }}
      </p>
    </div>
    <p v-if="activeTasks.length === 0" class="task-panel__empty">
      No active tasks right now.
    </p>
    <ul
      v-else
      class="task-panel__list"
      @dragover.prevent="handleListDragOver($event)"
      @drop.prevent="handleDropAtListEnd"
    >
      <template v-for="(task, index) in activeTasks" :key="task.id">
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
            @toggle="handleToggle"
            @remove="requestDelete"
            @edit="startEdit"
            @duplicate="handleDuplicate"
            @move-to-today="handleMoveToToday"
            @move-to-tomorrow="handleMoveToTomorrow"
          />
        </li>
      </template>
      <li
        v-if="dropIndicatorIndex === activeTasks.length"
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
  <TaskEditorDialog
    v-model:open="showEditDialog"
    :task="taskPendingEdit"
    @save="handleEditSave"
    @cancel="closeEdit"
  />
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.task-panel {
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  padding: 1.25rem;
  background: rgba(23, 23, 24, 0.6);
  box-shadow: 0 18px 32px -28px rgba(0, 0, 0, 0.85);
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
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.task-panel__controls {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.85rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  gap: 0.5rem;
}

.postpone-control {
  display: grid;
  gap: 0.4rem;
}

.postpone-control__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: theme.$color-text-muted;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.postpone-control__label-icon {
  color: theme.$color-accent;
}

.postpone-control__inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.postpone-control__date {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid theme.$color-border-input;
  border-radius: 0.6rem;
  color: theme.$color-text-primary;
  padding: 0.45rem 0.75rem;
  min-width: 11rem;

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.postpone-control__button {
  border: none;
  border-radius: 0.6rem;
  padding: 0.5rem 1.35rem;
  font-weight: 600;
  background: linear-gradient(135deg, theme.$color-accent, theme.$color-accent-hover);
  color: theme.$color-text-inverted;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.postpone-control__button-icon {
  color: theme.$color-text-inverted;
}

.postpone-control__status {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: theme.$color-text-muted;
}

.postpone-control__status--success {
  color: #4ade80;
}

.postpone-control__status--info {
  color: theme.$color-text-muted;
}

.postpone-control__status--error {
  color: theme.$color-accent;
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
