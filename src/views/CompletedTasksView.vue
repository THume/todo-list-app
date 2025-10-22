<script setup>
import { computed, ref } from 'vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  sortedCompletedTasks,
  reviveCompletedTask,
  deleteCompletedTask,
  updateCompletedTaskTimestamp,
} = useTaskStore();

const totalCompleted = computed(() => sortedCompletedTasks.value.length);

const parseCompletedDate = (value) => {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) {
    return null;
  }
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

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

const formatGroupHeading = (date) => {
  if (!date) {
    return 'Unknown date';
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);

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

const groupedEntries = computed(() => {
  const groups = [];
  const groupMap = new Map();

  sortedCompletedTasks.value.forEach((entry) => {
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

const formatRecurrence = (value) => {
  switch (value) {
    case 'daily':
      return 'Repeats daily';
    case 'weekdays':
      return 'Repeats on weekdays';
    case 'weekly':
      return 'Repeats weekly';
    case 'monthly':
      return 'Repeats monthly';
    case 'quarterly':
      return 'Repeats every 3 months';
    case 'yearly':
      return 'Repeats yearly';
    default:
      return '';
  }
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

const toTimeInputValue = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const buildIsoFromInputs = (dateInput, timeInput) => {
  if (!dateInput) {
    return null;
  }

  const normalizedTime =
    typeof timeInput === 'string' && timeInput.trim().length > 0 ? timeInput : '00:00';
  const candidate = new Date(`${dateInput}T${normalizedTime}`);

  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate.toISOString();
};

const editingEntryId = ref(null);
const editDate = ref('');
const editTime = ref('');
const editError = ref('');

const resetEditState = () => {
  editingEntryId.value = null;
  editDate.value = '';
  editTime.value = '';
  editError.value = '';
};

const showDeleteDialog = ref(false);
const entryPendingDelete = ref(null);

const startEditingEntry = (entry) => {
  if (!entry) {
    return;
  }

  if (editingEntryId.value === entry.taskId) {
    resetEditState();
    return;
  }

  editingEntryId.value = entry.taskId;
  editDate.value = toDateInputValue(entry.completedAt);
  editTime.value = toTimeInputValue(entry.completedAt);
  editError.value = '';
};

const handleCancelEdit = () => {
  resetEditState();
};

const handleSubmitEdit = () => {
  if (!editingEntryId.value) {
    return;
  }

  if (!editDate.value) {
    editError.value = 'Select a date to continue.';
    return;
  }

  const iso = buildIsoFromInputs(editDate.value, editTime.value);
  if (!iso) {
    editError.value = 'Enter a valid date and time.';
    return;
  }

  const updated = updateCompletedTaskTimestamp(editingEntryId.value, iso);
  if (!updated) {
    editError.value = 'Unable to update the completed date.';
    return;
  }

  resetEditState();
};

const handleRevive = (entry) => {
  if (!entry) {
    return;
  }
  const revived = reviveCompletedTask(entry.taskId);
  if (revived && editingEntryId.value === entry.taskId) {
    resetEditState();
  }
};

const requestDelete = (entry) => {
  entryPendingDelete.value = entry;
  showDeleteDialog.value = true;
};

const handleCancelDelete = () => {
  showDeleteDialog.value = false;
  entryPendingDelete.value = null;
};

const handleConfirmDelete = () => {
  if (entryPendingDelete.value) {
    const targetId = entryPendingDelete.value.taskId;
    deleteCompletedTask(targetId);
    if (editingEntryId.value === targetId) {
      resetEditState();
    }
  }
  handleCancelDelete();
};
</script>

<template>
  <section class="history">
    <header class="history__header">
      <h2>Completed Tasks</h2>
      <span class="history__count">{{ totalCompleted }} saved</span>
    </header>
    <p v-if="totalCompleted === 0" class="history__empty">
      No completed tasks yet. Finish a task to see it here.
    </p>
    <ul v-else class="history__groups">
      <li v-for="group in groupedEntries" :key="group.key" class="history__group">
        <h3 class="history__group-title">{{ group.label }}</h3>
        <ul class="history__list">
          <li v-for="entry in group.items" :key="entry.taskId" class="history__item">
            <div class="history__item-header">
              <span class="history__title">{{ entry.title }}</span>
              <time class="history__timestamp" :datetime="entry.completedAt">
                Completed {{ formatTimestamp(entry.completedAt) }}
              </time>
              <span v-if="entry.recurrence" class="history__recurrence">
                {{ formatRecurrence(entry.recurrence) }}
              </span>
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
            <div class="history__item-actions">
              <button type="button" class="history__action" @click="handleRevive(entry)">
                Revive
              </button>
              <button
                type="button"
                class="history__action"
                @click="startEditingEntry(entry)"
              >
                Adjust date
              </button>
              <button
                type="button"
                class="history__action history__action--danger"
                @click="requestDelete(entry)"
              >
                Delete
              </button>
            </div>
            <div v-if="editingEntryId === entry.taskId" class="history__edit-panel">
              <form class="history__edit-form" @submit.prevent="handleSubmitEdit">
                <div class="history__edit-fields">
                  <label class="history__edit-field">
                    <span>Date</span>
                    <input
                      v-model="editDate"
                      type="date"
                      name="completedDate"
                      aria-label="Completed date"
                      required
                    />
                  </label>
                  <label class="history__edit-field">
                    <span>Time</span>
                    <input
                      v-model="editTime"
                      type="time"
                      name="completedTime"
                      aria-label="Completed time"
                    />
                  </label>
                </div>
                <p v-if="editError" class="history__edit-error">
                  {{ editError }}
                </p>
                <div class="history__edit-actions">
                  <button type="submit" class="history__edit-button history__edit-button--primary">
                    Save
                  </button>
                  <button
                    type="button"
                    class="history__edit-button"
                    @click="handleCancelEdit"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </li>
        </ul>
      </li>
    </ul>
  </section>
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

.history__count {
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.history__empty {
  margin: 0;
  padding: 1rem 0;
  color: theme.$color-text-muted;
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

.history__item {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  background: rgba(23, 23, 24, 0.55);
  display: grid;
  gap: 0.5rem;
}

.history__item-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.history__action {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;

  &:hover {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(239, 68, 68, 0.1);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.history__action--danger {
  border-color: rgba(239, 68, 68, 0.6);
  color: rgba(248, 113, 113, 0.95);

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ffffff;
  }
}

.history__item-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.history__title {
  font-weight: 600;
}

.history__timestamp {
  color: theme.$color-text-muted;
  font-size: 0.85rem;
}

.history__recurrence {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.16);
  color: #4ade80;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.history__description {
  margin: 0;
  color: #d4d4d8;
  opacity: 0.85;
}

.history__edit-panel {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed theme.$color-border-input;
}

.history__edit-form {
  display: grid;
  gap: 0.75rem;
}

.history__edit-fields {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
}

.history__edit-field {
  display: grid;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: theme.$color-text-muted;
}

.history__edit-field input {
  width: 100%;
  border: 1px solid theme.$color-border-input;
  background: rgba(12, 12, 13, 0.6);
  color: theme.$color-text-primary;
  padding: 0.45rem 0.6rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.history__edit-field input:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
  border-color: theme.$color-accent;
  background: rgba(12, 12, 13, 0.85);
}

.history__edit-error {
  margin: 0;
  color: rgba(248, 113, 113, 0.95);
  font-size: 0.85rem;
}

.history__edit-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.history__edit-button {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.history__edit-button:hover {
  color: theme.$color-text-heading;
  border-color: theme.$color-accent;
  background: rgba(34, 197, 94, 0.15);
  transform: translateY(-1px);
}

.history__edit-button:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.history__edit-button--primary {
  background: theme.$color-accent;
  border-color: theme.$color-accent;
  color: theme.$color-text-inverted;
}

.history__edit-button--primary:hover {
  background: theme.$color-accent-hover;
  border-color: theme.$color-accent-hover;
}

.history__due {
  color: theme.$color-accent;
  font-size: 0.85rem;
}
</style>
