<script setup>
import { computed, ref } from 'vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import Task from '../components/Task.vue';
import AdjustCompletionDateModal from '../components/AdjustCompletionDateModal.vue';
import AddEditTaskModal from '../components/AddEditTaskModal.vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  sortedCompletedTasks,
  reviveCompletedTask,
  deleteCompletedTask,
  updateCompletedTaskTimestamp,
  duplicateTask,
  addTask,
  updateTask,
  lists,
} = useTaskStore();

const parseCompletedDate = (value) => {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) {
    return null;
  }
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const formatGroupHeading = (date) => {
  if (!date) {
    return 'Unknown date';
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);

  const isSameDay = (a, b) => {
    if (!a || !b) {
      return false;
    }
    return (
      a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate()
    );
  };

  if (isSameDay(date, todayStart)) {
    return 'Today';
  }

  if (isSameDay(date, yesterdayStart)) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const toDateInputValue = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const filterStartDate = ref('');
const filterEndDate = ref('');

const filterBounds = computed(() => {
  const startDate = parseDateInputValue(filterStartDate.value);
  const endDate = parseDateInputValue(filterEndDate.value);

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
    startDate: rangeStart ?? null,
    endDate: rangeEnd ?? null,
    hasFilter: start !== null || end !== null,
  };
});

const filteredCompletedEntries = computed(() => {
  const { start, end, hasFilter } = filterBounds.value;

  return sortedCompletedTasks.value.filter((entry) => {
    const timestamp = Date.parse(entry?.completedAt ?? '');

    if (Number.isNaN(timestamp)) {
      return !hasFilter;
    }

    if (start !== null && timestamp < start) {
      return false;
    }

    if (end !== null && timestamp >= end) {
      return false;
    }

    return true;
  });
});

const totalCompleted = computed(() => sortedCompletedTasks.value.length);
const visibleCompleted = computed(() => filteredCompletedEntries.value.length);

const completedCountLabel = computed(() => {
  if (filterBounds.value.hasFilter) {
    return `${visibleCompleted.value} of ${totalCompleted.value} saved`;
  }
  return `${totalCompleted.value} saved`;
});

const filterMaxDate = computed(() => toDateInputValue(new Date()));

const filterDescription = computed(() => {
  const { startDate, endDate, hasFilter } = filterBounds.value;
  if (!hasFilter) {
    return 'Showing all completed tasks';
  }

  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

  if (startDate && endDate) {
    const startLabel = formatter.format(startDate);
    const endLabel = formatter.format(endDate);
    if (startLabel === endLabel) {
      return `Showing tasks completed on ${startLabel}`;
    }
    return `Showing tasks completed between ${startLabel} and ${endLabel}`;
  }

  if (startDate) {
    return `Showing tasks completed on or after ${formatter.format(startDate)}`;
  }

  if (endDate) {
    return `Showing tasks completed on or before ${formatter.format(endDate)}`;
  }

  return 'Showing all completed tasks';
});

const groupedEntries = computed(() => {
  const groups = [];
  const groupMap = new Map();

  filteredCompletedEntries.value.forEach((entry) => {
    const day = parseCompletedDate(entry.completedAt);
    const key = day
      ? `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      : 'unknown';

    let group = groupMap.get(key);

    if (!group) {
      group = {
        key,
        label: formatGroupHeading(day),
        date: day,
        items: [],
      };

      groupMap.set(key, group);
      groups.push(group);
    }

    group.items.push(entry);
  });

  return groups;
});

const showAdjustDateModal = ref(false);
const taskBeingAdjusted = ref(null);

const showEditModal = ref(false);
const taskPendingEdit = ref(null);
const showDuplicateDialog = ref(false);
const taskPendingDuplicate = ref(null);

const clearFilters = () => {
  filterStartDate.value = '';
  filterEndDate.value = '';
};

const showDeleteDialog = ref(false);
const entryPendingDelete = ref(null);

const handleToggle = (task) => {
  reviveCompletedTask(task.id);
};

const handleDuplicate = (task) => {
  taskPendingDuplicate.value = task;
  showDuplicateDialog.value = true;
};

const closeDuplicateModal = () => {
  showDuplicateDialog.value = false;
  taskPendingDuplicate.value = null;
};

const handleDuplicateSubmit = (payload) => {
  addTask(payload);
  closeDuplicateModal();
};

const closeEditModal = () => {
  showEditModal.value = false;
};

const handleEditSave = (payload) => {
  updateTask(payload);
  closeEditModal();
};

const handleAdjustCompletionDate = (task) => {
  taskBeingAdjusted.value = task;
  showAdjustDateModal.value = true;
};

const handleSaveAdjustedDate = (isoDate) => {
  if (taskBeingAdjusted.value) {
    updateCompletedTaskTimestamp(taskBeingAdjusted.value.id, isoDate);
  }
  showAdjustDateModal.value = false;
  taskBeingAdjusted.value = null;
};

const handleCancelAdjustDate = () => {
  showAdjustDateModal.value = false;
  taskBeingAdjusted.value = null;
};

const requestDelete = (task) => {
  entryPendingDelete.value = task;
  showDeleteDialog.value = true;
};

const handleCancelDelete = () => {
  showDeleteDialog.value = false;
  entryPendingDelete.value = null;
};

const handleConfirmDelete = () => {
  if (entryPendingDelete.value) {
    const targetId = entryPendingDelete.value.id;
    deleteCompletedTask(targetId);
  }
  handleCancelDelete();
};
</script>

<template>
  <section class="history">
    <header class="history__header">
      <div>
        <h2>Completed Tasks</h2>
        <p class="history__subtitle">{{ filterDescription }}</p>
      </div>
      <span class="history__count">{{ completedCountLabel }}</span>
    </header>
    <div class="history__filters" aria-live="polite">
      <div class="history__filter-fields">
        <label class="history__filter-field">
          <span>From</span>
          <input
            v-model="filterStartDate"
            type="date"
            name="completed-start"
            :max="filterMaxDate"
            aria-label="Filter completed tasks from date"
          />
        </label>
        <label class="history__filter-field">
          <span>To</span>
          <input
            v-model="filterEndDate"
            type="date"
            name="completed-end"
            :max="filterMaxDate"
            aria-label="Filter completed tasks to date"
          />
        </label>
      </div>
      <div class="history__filter-actions">
        <button
          type="button"
          class="history__filter-button"
          :disabled="!filterBounds.hasFilter"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>
    </div>
    <p v-if="totalCompleted === 0" class="history__empty">
      No completed tasks yet. Finish a task to see it here.
    </p>
    <p v-else-if="visibleCompleted === 0" class="history__empty">
      No tasks match the selected dates.
    </p>
    <ul v-else class="history__groups">
      <li v-for="group in groupedEntries" :key="group.key" class="history__group">
        <h3 class="history__group-title">{{ group.label }}</h3>
        <ul class="history__list">
          <li v-for="entry in group.items" :key="entry.id">
            <Task
              :task="entry"
              :is-completed-page="true"
              :completed-date="entry.completedAt"
              @toggle="handleToggle"
              @remove="requestDelete"
              @duplicate="handleDuplicate"
              @adjust-completion-date="handleAdjustCompletionDate"
            />
          </li>
        </ul>
      </li>
    </ul>
  </section>
  <AddEditTaskModal
    :visible="showEditModal"
    mode="edit"
    :lists="lists"
    :task="taskPendingEdit"
    @save="handleEditSave"
    @cancel="closeEditModal"
  />
  <AddEditTaskModal
    v-model:visible="showDuplicateDialog"
    mode="duplicate"
    :task="taskPendingDuplicate"
    :lists="lists"
    @submit="handleDuplicateSubmit"
    @cancel="closeDuplicateModal"
  />
  <AdjustCompletionDateModal
    v-model:visible="showAdjustDateModal"
    :task-title="taskBeingAdjusted?.title || ''"
    :current-completed-at="taskBeingAdjusted?.completedAt"
    @save="handleSaveAdjustedDate"
    @cancel="handleCancelAdjustDate"
  />
  <ConfirmDialog
    v-model:open="showDeleteDialog"
    title="Delete completed task?"
    confirm-label="Delete"
    cancel-label="Cancel"
    :item-label="entryPendingDelete?.title || ''"
    message="This will permanently remove the completed task and its history."
    @confirm="handleConfirmDelete"
    @cancel="handleCancelDelete"
  />
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.history {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  background: rgba(23, 23, 24, 0.6);
  box-shadow: 0 18px 32px -28px rgba(0, 0, 0, 0.85);

  @media (max-width: 640px) {
    padding: 1rem;
  }
}

.history__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.history__subtitle {
  margin: 0.15rem 0 0;
  color: theme.$color-text-muted;
  font-size: 0.9rem;
}

.history__count {
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.history__empty {
  margin: 0;
  padding: 1rem 0;
  color: theme.$color-text-muted;
}

.history__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: 0.35rem;
  border-bottom: 1px dashed theme.$color-border-input;
}

.history__filter-fields {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  flex: 1;
}

.history__filter-field {
  display: grid;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: theme.$color-text-muted;
}

.history__filter-field input {
  width: 100%;
  border: 1px solid theme.$color-border-input;
  background: rgba(12, 12, 13, 0.6);
  color: theme.$color-text-primary;
  padding: 0.45rem 0.6rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.history__filter-field input:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
  border-color: theme.$color-accent;
  background: rgba(12, 12, 13, 0.85);
}

.history__filter-actions {
  display: flex;
  gap: 0.5rem;
}

.history__filter-button {
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

.history__filter-button:hover:enabled {
  color: theme.$color-text-heading;
  border-color: theme.$color-accent;
  background: rgba(34, 197, 94, 0.15);
  transform: translateY(-1px);
}

.history__filter-button:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.history__filter-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}

.history__groups {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1.5rem;
}

.history__group {
  display: grid;
  gap: 0.75rem;
}

.history__group-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}
</style>
