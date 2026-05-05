<script setup>
import { computed, ref, watch } from 'vue';
import Task from '../components/Task.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import AddEditTaskModal from '../components/AddEditTaskModal.vue';
import IconGlyph from '../components/IconGlyph.vue';
import { useTaskStore } from '../stores/useTaskStore';
import { sortTasksForDisplay } from '../utils/taskSort';

const {
  tasks,
  activeTasks,
  toggleTaskCompletion,
  removeTask,
  updateTask,
  reorderTask,
  duplicateTask,
  addTask,
  toggleSubtaskCompletion,
  moveTaskToToday,
  moveTaskToTomorrow,
  markTaskWorkedOn,
  markLongTermTaskWorkedOn,
  postponeTasksUntil,
  lists,
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
const searchTerm = ref('');
const dueFilterStartDate = ref('');
const dueFilterEndDate = ref('');
const showNoDueDateOnly = ref(false);
const sortMode = ref('user');

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

const normalizedSearch = computed(() => searchTerm.value.trim().toLowerCase());
const parseDateInputValue = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));

  if (
    Number.isNaN(year)
    || Number.isNaN(month)
    || Number.isNaN(day)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
};

const taskDueDayTimestamp = (task) => {
  const dueValue = task?.due;
  if (typeof dueValue !== 'string' || dueValue.trim().length === 0) {
    return null;
  }

  const date = new Date(dueValue);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return dayStart.getTime();
};

const dueFilterBounds = computed(() => {
  const startDate = parseDateInputValue(dueFilterStartDate.value);
  const endDate = parseDateInputValue(dueFilterEndDate.value);

  let rangeStart = startDate;
  let rangeEnd = endDate;

  if (
    rangeStart instanceof Date
    && rangeEnd instanceof Date
    && rangeStart.getTime() > rangeEnd.getTime()
  ) {
    [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
  }

  const start = rangeStart ? rangeStart.getTime() : null;
  let end = null;

  if (rangeEnd instanceof Date) {
    const exclusiveEnd = new Date(rangeEnd);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
    end = exclusiveEnd.getTime();
  }

  return {
    start,
    end,
    hasDateFilter: start !== null || end !== null,
  };
});

const hasAnyFilter = computed(() =>
  normalizedSearch.value.length > 0
  || dueFilterBounds.value.hasDateFilter
  || showNoDueDateOnly.value
);

const visibleTasks = computed(() => {
  const current = Array.isArray(activeTasks.value) ? activeTasks.value : [];
  const term = normalizedSearch.value;
  const { start, end } = dueFilterBounds.value;

  return current.filter((task) => {
    const dueDay = taskDueDayTimestamp(task);

    if (showNoDueDateOnly.value && dueDay !== null) {
      return false;
    }

    if (!showNoDueDateOnly.value && (start !== null || end !== null)) {
      if (dueDay === null) {
        return false;
      }
      if (start !== null && dueDay < start) {
        return false;
      }
      if (end !== null && dueDay >= end) {
        return false;
      }
    }

    if (!term) {
      return true;
    }

    const title = typeof task?.title === 'string' ? task.title.toLowerCase() : '';
    const description =
      typeof task?.description === 'string' ? task.description.toLowerCase() : '';
    return title.includes(term) || description.includes(term);
  });
});
const sortedVisibleTasks = computed(() =>
  sortTasksForDisplay(visibleTasks.value, sortMode.value)
);

const activeCount = computed(() => activeTasks.value?.length ?? 0);
const visibleCount = computed(() => visibleTasks.value.length);
const countLabel = computed(() => {
  if (!hasAnyFilter.value) {
    return `${activeCount.value} active`;
  }
  return `${visibleCount.value} of ${activeCount.value} active`;
});

const noResultsMessage = computed(() => {
  if (!hasAnyFilter.value) {
    return 'No active tasks right now.';
  }
  if (showNoDueDateOnly.value) {
    return 'No tasks match the selected filters.';
  }
  if (dueFilterBounds.value.hasDateFilter && normalizedSearch.value) {
    return 'No tasks match your search and due date filters.';
  }
  if (dueFilterBounds.value.hasDateFilter) {
    return 'No tasks are due in the selected date range.';
  }
  return 'No tasks match your search.';
});

const clearAllFilters = () => {
  searchTerm.value = '';
  dueFilterStartDate.value = '';
  dueFilterEndDate.value = '';
  showNoDueDateOnly.value = false;
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

const handleToggleSubtask = ({ taskId, subtaskId }) => {
  toggleSubtaskCompletion(taskId, subtaskId);
};

const getWorkedOnActionLabel = (task) => {
  if (!task) {
    return '';
  }
  if (task.recurrence) {
    return 'Mark as "Worked on" and move to next occurrence';
  }
  return task.due
    ? 'Mark as "Worked on" and move to next day'
    : 'Mark as "Worked on" and duplicate';
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
  if (sortMode.value !== 'user') {
    return;
  }
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
  if (sortMode.value !== 'user') {
    return;
  }
  if (!draggedTaskId.value || draggedTaskId.value === task.id) {
    return;
  }
  const allTasks = tasks.value ?? [];
  const filteredTasks = visibleTasks.value ?? [];
  const sourceIndex = allTasks.findIndex((item) => item.id === draggedTaskId.value);
  const targetIndex = allTasks.findIndex((item) => item.id === task.id);

  if (sourceIndex < 0 || targetIndex < 0) {
    dropIndicatorIndex.value = -1;
    return;
  }

  const targetIndexVisible = filteredTasks.findIndex((item) => item.id === task.id);
  const sourceIndexVisible = filteredTasks.findIndex((item) => item.id === draggedTaskId.value);

  let indicatorIndex = targetIndexVisible >= 0 ? targetIndexVisible : 0;

  if (sourceIndex < targetIndex) {
    indicatorIndex = targetIndexVisible >= 0 ? targetIndexVisible + 1 : filteredTasks.length;
  } else if (sourceIndexVisible >= 0 && targetIndexVisible >= 0) {
    indicatorIndex = targetIndexVisible;
  }

  dropIndicatorIndex.value = indicatorIndex;
  dragOverTaskId.value = task.id;
};

const handleDragLeave = (task) => {
  if (sortMode.value !== 'user') {
    return;
  }
  if (dragOverTaskId.value === task.id) {
    dragOverTaskId.value = null;
    dropIndicatorIndex.value = -1;
  }
};

const handleDrop = (task) => {
  if (sortMode.value !== 'user') {
    return;
  }
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
  if (sortMode.value !== 'user') {
    return;
  }
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
  if (sortMode.value !== 'user') {
    return;
  }
  if (!draggedTaskId.value) {
    return;
  }
  if (event?.target !== event?.currentTarget) {
    return;
  }
  dropIndicatorIndex.value = visibleTasks.value.length;
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
      <h2>All Tasks</h2>
      <span class="task-panel__count">{{ countLabel }}</span>
    </header>
    <div class="task-panel__controls">
      <div class="task-panel__search">
        <label class="task-panel__search-label" for="task-search-input">
          <IconGlyph
            name="search"
            size="16"
            class="task-panel__search-icon"
            aria-hidden="true"
          />
          <span>Search tasks</span>
        </label>
        <input
          id="task-search-input"
          v-model="searchTerm"
          type="search"
          class="task-panel__search-input"
          name="task-search"
          autocomplete="off"
          placeholder="Search by title or description"
          aria-label="Search tasks"
        />
      </div>
      <div class="task-panel__filters" aria-live="polite">
        <div class="task-panel__filter-fields">
          <label class="task-panel__filter-field" for="task-due-start-input">
            <span>Due from</span>
            <input
              id="task-due-start-input"
              v-model="dueFilterStartDate"
              type="date"
              name="task-due-start"
              aria-label="Show tasks due on or after this date"
            />
          </label>
          <label class="task-panel__filter-field" for="task-due-end-input">
            <span>Due to</span>
            <input
              id="task-due-end-input"
              v-model="dueFilterEndDate"
              type="date"
              name="task-due-end"
              aria-label="Show tasks due on or before this date"
            />
          </label>
          <label class="task-panel__filter-checkbox" for="task-no-due-only">
            <input
              id="task-no-due-only"
              v-model="showNoDueDateOnly"
              type="checkbox"
              name="task-no-due-only"
            />
            <span>Only show tasks without a due date</span>
          </label>
        </div>
        <div class="task-panel__filter-actions">
          <button
            type="button"
            class="task-panel__filter-button"
            :disabled="!hasAnyFilter"
            @click="clearAllFilters"
          >
            Clear all filters
          </button>
        </div>
      </div>
      <div class="task-panel__sort-controls">
        <label for="all-tasks-sort-by" class="task-panel__sort-label">Sort By:</label>
        <select
          id="all-tasks-sort-by"
          v-model="sortMode"
          class="task-panel__sort-select"
        >
          <option value="due-date">Due date</option>
          <option value="user">User</option>
        </select>
      </div>
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
    <p v-if="activeCount === 0" class="task-panel__empty">
      No active tasks right now.
    </p>
    <p v-else-if="visibleCount === 0" class="task-panel__empty">
      {{ noResultsMessage }}
    </p>
    <ul
      v-else
      class="task-panel__list"
      @dragover.prevent="handleListDragOver($event)"
      @drop.prevent="handleDropAtListEnd"
    >
      <template v-for="(task, index) in sortedVisibleTasks" :key="task.id">
        <li
          v-if="sortMode === 'user' && dropIndicatorIndex === index"
          class="task-panel__drop-indicator"
        />
        <li
          class="task-panel__item"
          :class="{
            'task-panel__item--drag-over': dragOverTaskId === task.id,
            'task-panel__item--dragging': draggedTaskId === task.id,
          }"
          :draggable="sortMode === 'user' && !task.completed"
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
            @toggle-subtask="handleToggleSubtask"
          />
        </li>
      </template>
      <li
        v-if="sortMode === 'user' && dropIndicatorIndex === sortedVisibleTasks.length"
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
  gap: 0.75rem;
}

.task-panel__search {
  display: grid;
  gap: 0.35rem;
}

.task-panel__search-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  color: theme.$color-text-muted;
  font-size: 0.9rem;
}

.task-panel__search-icon {
  color: theme.$color-accent;
}

.task-panel__search-input {
  width: 100%;
  border: 1px solid theme.$color-border-input;
  border-radius: 0.65rem;
  padding: 0.55rem 0.75rem;
  background: rgba(0, 0, 0, 0.35);
  color: theme.$color-text-primary;
  font: inherit;

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
    border-color: theme.$color-accent;
    background: rgba(0, 0, 0, 0.45);
  }
}

.task-panel__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: 0.35rem;
  border-bottom: 1px dashed theme.$color-border-input;
}

.task-panel__filter-fields {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  flex: 1;
}

.task-panel__filter-field {
  display: grid;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: theme.$color-text-muted;
}

.task-panel__filter-field input {
  width: 100%;
  border: 1px solid theme.$color-border-input;
  background: rgba(12, 12, 13, 0.6);
  color: theme.$color-text-primary;
  padding: 0.45rem 0.6rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.task-panel__filter-field input:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
  border-color: theme.$color-accent;
  background: rgba(12, 12, 13, 0.85);
}

.task-panel__filter-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  color: theme.$color-text-muted;
}

.task-panel__filter-checkbox input {
  inline-size: 1rem;
  block-size: 1rem;
  accent-color: theme.$color-accent;
}

.task-panel__filter-actions {
  display: flex;
  gap: 0.5rem;
}

.task-panel__filter-button {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
}

.task-panel__filter-button:hover:enabled {
  color: theme.$color-text-heading;
  border-color: theme.$color-accent;
  background: rgba(34, 197, 94, 0.15);
  transform: translateY(-1px);
}

.task-panel__filter-button:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.task-panel__filter-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.task-panel__sort-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.task-panel__sort-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.task-panel__sort-select {
  border: 1px solid theme.$color-border-input;
  background: rgba(255, 255, 255, 0.04);
  color: theme.$color-text-heading;
  padding: 0.4rem 0.65rem;
  border-radius: 0.4rem;
  font-size: 0.9rem;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }

  option {
    background: #1c1c1d;
    color: #e5e5e5;
  }
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
