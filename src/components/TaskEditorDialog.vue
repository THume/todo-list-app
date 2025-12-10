<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useTaskStore } from '../stores/useTaskStore';
import {
  getTodayDateString,
  normalizeTaskLists,
  resolveListId,
  recurrenceOptions,
} from '../composables/useTaskFormHelpers';
import IconGlyph from './IconGlyph.vue';

const { lists } = useTaskStore();

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  task: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:open', 'save', 'cancel']);

const panel = ref(null);
const titleField = ref(null);
const title = ref('');
const description = ref('');
const dueDate = ref('');
const dueTime = ref('');
const recurrence = ref('none');
const lastTaskId = ref(null);
const selectedListId = ref('');
const reminderOffset = ref('none');
const setDueDateToToday = () => {
  dueDate.value = getTodayDateString();
};

const listOptions = computed(() => normalizeTaskLists(lists.value));

const canSave = computed(() => title.value.trim().length > 0);

const close = () => {
  emit('update:open', false);
};

const handleCancel = () => {
  close();
  emit('cancel');
};

const formatDateInput = (isoString) => {
  if (!isoString) {
    return '';
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeInput = (isoString) => {
  if (!isoString) {
    return '';
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const applyTask = (task) => {
  if (!task) {
    title.value = '';
    description.value = '';
    dueDate.value = '';
    dueTime.value = '';
  recurrence.value = 'none';
  lastTaskId.value = null;
  selectedListId.value = resolveListId(listOptions.value, null);
  reminderOffset.value = 'none';
  return;
}

title.value = task.title ?? '';
description.value = task.description ?? '';
dueDate.value = formatDateInput(task.due);
dueTime.value = formatTimeInput(task.due);
recurrence.value = task.recurrence ?? 'none';
lastTaskId.value = task.id ?? null;
selectedListId.value = resolveListId(listOptions.value, task.listId);

  const minutes = Number(task.reminderOffsetMinutes);
  if (Number.isFinite(minutes) && minutes > 0 && task.due) {
    reminderOffset.value = String(minutes);
  } else {
    reminderOffset.value = 'none';
  }
};

const handleSave = () => {
  const trimmedTitle = title.value.trim();
  if (trimmedTitle.length === 0 || !props.task) {
    return;
  }

  emit('save', {
    id: props.task.id,
    title: trimmedTitle,
    description: description.value.trim(),
    dueDate: dueDate.value || null,
    dueTime: dueTime.value || null,
    recurrence: recurrence.value,
    listId: selectedListId.value || null,
    reminderOffsetMinutes: reminderOffset.value === 'none' ? null : Number(reminderOffset.value),
  });

  close();
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      applyTask(props.task);
      nextTick(() => {
        panel.value?.focus();
        titleField.value?.focus();
      });
    }
  }
);

watch(
  () => props.task,
  (task) => {
    if (!props.open) {
      return;
    }

    if (task?.id !== lastTaskId.value) {
      applyTask(task);
      nextTick(() => {
        titleField.value?.focus();
      });
    }
  }
);

watch(
  listOptions,
  (options) => {
    if (!options.length) {
      selectedListId.value = '';
      return;
    }
    selectedListId.value = resolveListId(options, selectedListId.value);
  },
  { immediate: true }
);

watch(dueDate, (value) => {
  if (!value) {
    dueTime.value = '';
    reminderOffset.value = 'none';
  }
});
</script>

<template>
  <transition name="dialog-fade">
    <div
      v-if="open"
      class="task-editor"
      role="presentation"
      @click.self="handleCancel"
    >
      <section
        ref="panel"
        class="add-task add-task--dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        tabindex="-1"
        @keydown.esc.prevent="handleCancel"
      >
        <header class="add-task__header">
          <h1 id="task-editor-title" class="add-task__title">
            <IconGlyph
              name="pencil"
              size="18"
              class="add-task__title-icon"
              aria-hidden="true"
            />
            Edit Task
          </h1>
          <button
            type="button"
            class="add-task__close"
            aria-label="Close editor"
            @click.stop.prevent="handleCancel"
          >
            <IconGlyph name="close" size="20" aria-hidden="true" />
          </button>
        </header>
        <form class="add-task__form" @submit.prevent="handleSave">
          <div class="add-task__fields">
            <div class="add-task__input-shell">
              <IconGlyph
                name="text"
                size="16"
                class="add-task__field-icon"
                aria-hidden="true"
              />
              <input
                ref="titleField"
                v-model="title"
                type="text"
                class="add-task__input add-task__input--with-icon"
                name="title"
                autocomplete="off"
                placeholder="Task title"
                aria-label="Task title"
                required
              />
            </div>
            <div class="add-task__input-shell add-task__input-shell--textarea">
              <IconGlyph
                name="pencil"
                size="16"
                class="add-task__field-icon"
                aria-hidden="true"
              />
              <textarea
                v-model="description"
                class="add-task__textarea add-task__textarea--with-icon"
                name="description"
                placeholder="Description (optional)"
                aria-label="Task description"
                rows="2"
              />
            </div>
            <label class="add-task__due-label add-task__list">
              <span class="add-task__label-heading">
                <IconGlyph
                  name="folder"
                  size="14"
                  class="add-task__label-icon"
                  aria-hidden="true"
                />
                <span>List</span>
              </span>
              <select
                v-model="selectedListId"
                class="add-task__select"
                name="list"
                aria-label="Task list"
                :disabled="listOptions.length === 0"
              >
                <option v-for="list in listOptions" :key="list.id" :value="list.id">
                  {{ list.name }}
                </option>
              </select>
            </label>
            <div class="add-task__due-row">
              <label class="add-task__due-label">
                <span class="add-task__label-heading">
                  <IconGlyph
                    name="calendar"
                    size="14"
                    class="add-task__label-icon"
                    aria-hidden="true"
                  />
                  <span>Due date</span>
                </span>
                <div class="add-task__due-input-wrapper">
                  <input
                    v-model="dueDate"
                    type="date"
                    name="dueDate"
                    class="add-task__due-input"
                    aria-label="Due date"
                  />
                  <button
                    type="button"
                    class="add-task__today-button"
                    @click="setDueDateToToday"
                  >
                    Today
                  </button>
                </div>
              </label>
              <label class="add-task__due-label">
                <span class="add-task__label-heading">
                  <IconGlyph
                    name="clock"
                    size="14"
                    class="add-task__label-icon"
                    aria-hidden="true"
                  />
                  <span>Due time</span>
                </span>
                <input
                  v-model="dueTime"
                  type="time"
                  name="dueTime"
                  class="add-task__due-input"
                  aria-label="Due time"
                  :disabled="!dueDate"
                />
              </label>
            </div>
            <label class="add-task__due-label add-task__recurrence">
              <span class="add-task__label-heading">
                <IconGlyph
                  name="repeat"
                  size="14"
                  class="add-task__label-icon"
                  aria-hidden="true"
                />
                <span>Repeats</span>
              </span>
              <select
                v-model="recurrence"
                name="recurrence"
                class="add-task__select"
                aria-label="Recurrence"
              >
                <option
                  v-for="option in recurrenceOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="add-task__due-label add-task__reminder">
              <span class="add-task__label-heading">
                <IconGlyph
                  name="alert"
                  size="14"
                  class="add-task__label-icon"
                  aria-hidden="true"
                />
                <span>Reminder</span>
              </span>
              <select
                v-model="reminderOffset"
                name="reminder"
                class="add-task__select"
                aria-label="Reminder time"
                :disabled="!dueDate"
              >
                <option value="none">No reminder</option>
                <option value="5">5 minutes before</option>
                <option value="10">10 minutes before</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="120">2 hours before</option>
                <option value="240">4 hours before</option>
                <option value="1440">1 day before</option>
              </select>
            </label>
          </div>
          <footer class="add-task__actions">
            <button
              type="button"
              class="add-task__submit add-task__submit--secondary"
              @click.stop.prevent="handleCancel"
            >
              Cancel
            </button>
            <button type="submit" class="add-task__submit" :disabled="!canSave">
              Save changes
            </button>
          </footer>
        </form>
      </section>
    </div>
  </transition>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

$dialog-backdrop: theme.$color-overlay-strong;
$panel-bg: rgba(27, 27, 29, 0.96);
$panel-border: rgba(255, 255, 255, 0.08);
$input-bg: rgba(255, 255, 255, 0.06);
$input-bg-focus: rgba(255, 255, 255, 0.1);
$input-border: rgba(255, 255, 255, 0.12);
$input-text: theme.$color-text-primary;
$button-bg: #ef4444;
$button-bg-hover: #f87171;
$disabled-bg: rgba(255, 255, 255, 0.15);
$disabled-text: rgba(255, 255, 255, 0.6);
$focus-outline: rgba(248, 113, 113, 0.35);
$checkbox-border: rgba(255, 255, 255, 0.35);
$checkbox-bg: rgba(255, 255, 255, 0.08);
$checkbox-accent: #22c55e;
$checkbox-checked-bg: rgba(34, 197, 94, 0.12);
$checkbox-checked-border: rgba(34, 197, 94, 0.55);
$checkbox-icon: #4ade80;

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.task-editor {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: $dialog-backdrop;
  z-index: 1100;
  padding: 3rem 1.5rem;
  box-sizing: border-box;

  @media (max-width: 640px) {
    padding: 1.5rem 0.75rem;
  }
}

.add-task--dialog {
  border: 1px solid $panel-border;
  border-radius: 1.5rem;
  padding: 1.5rem;
  background: $panel-bg;
  display: grid;
  gap: 1rem;
  width: min(640px, 100%);
  box-shadow: 0 32px 65px -40px rgba(0, 0, 0, 0.9);
  max-height: calc(100vh - 3rem);
  overflow-y: auto;

  @media (max-width: 640px) {
    border-radius: 1.25rem;
  }
}

.add-task__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.add-task__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.add-task__title-icon {
  color: theme.$color-accent;
}

.add-task__close {
  border: 1px solid $panel-border;
  background: transparent;
  color: theme.$color-text-primary;
  font-size: 1.5rem;
  line-height: 1;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  &:focus-visible {
    outline: 2px solid $focus-outline;
    outline-offset: 2px;
  }
}

.add-task__form {
  display: grid;
  gap: 1.5rem;
}

.add-task__fields {
  display: grid;
  gap: 1.25rem;
}

.add-task__input-shell {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid $input-border;
  border-radius: 1rem;
  background: $input-bg;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

  &:focus-within {
    border-color: $button-bg;
    box-shadow: 0 0 0 3px $focus-outline;
    background: $input-bg-focus;
  }
}

.add-task__input-shell--textarea {
  align-items: flex-start;
}

.add-task__field-icon {
  color: theme.$color-accent;
  margin-top: 0.05rem;
}

.add-task__input,
.add-task__textarea {
  border: none;
  background: transparent;
  color: $input-text;
  font-size: 1rem;
  font-family: inherit;
  padding: 0;
  min-width: 0;

  &:focus {
    outline: none;
  }
}

.add-task__textarea {
  resize: vertical;
  min-height: 4.25rem;
}

.add-task__label-heading {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  font-size: 0.95rem;
  color: $input-text;
}

.add-task__label-icon {
  color: theme.$color-text-muted;
}

.add-task__list,
.add-task__recurrence,
.add-task__due-label {
  display: grid;
  gap: 0.55rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid $input-border;
  border-radius: 1rem;
  background: $input-bg;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

  &:focus-within {
    border-color: $button-bg;
    box-shadow: 0 0 0 3px $focus-outline;
    background: $input-bg-focus;
  }
}

.add-task__due-row {
  display: grid;
  gap: 0.75rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.add-task__due-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.add-task__due-input {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid $input-border;
  border-radius: 0.75rem;
  padding: 0.65rem 0.8rem;
  font-size: 1rem;
  font-family: inherit;
  background: $input-bg;
  color: $input-text;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

  &:focus {
    outline: none;
    border-color: $button-bg;
    box-shadow: 0 0 0 3px $focus-outline;
    background: $input-bg-focus;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.add-task__select {
  width: 100%;
  border: 1px solid $input-border;
  border-radius: 0.75rem;
  padding: 0.75rem 0.9rem;
  font-size: 1rem;
  font-family: inherit;
  background: $input-bg;
  color: $input-text;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  appearance: none;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: $button-bg;
    box-shadow: 0 0 0 3px $focus-outline;
    background: $input-bg-focus;
  }
}

.add-task__today-button {
  border: 1px solid $panel-border;
  background: $input-bg;
  color: $input-text;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: $input-bg-focus;
    border-color: $input-border;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid $focus-outline;
    outline-offset: 2px;
  }
}

.add-task__actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
  align-items: center;
}

.add-task__submit {
  align-self: start;
  border: none;
  background: $button-bg;
  color: theme.$color-text-inverted;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: 0 12px 20px -18px rgba(239, 68, 68, 0.7);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  &:disabled {
    cursor: not-allowed;
    background: $disabled-bg;
    box-shadow: none;
    color: $disabled-text;
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 30px -22px rgba(248, 113, 113, 0.9);
    background: $button-bg-hover;
  }

  @media (max-width: 640px) {
    width: 100%;
    justify-self: stretch;
    text-align: center;
  }
}

.add-task__submit--secondary {
  background: transparent;
  color: $button-bg;
  border: 1px solid $button-bg;
  box-shadow: none;

  &:not(:disabled):hover {
    background: rgba(239, 68, 68, 0.1);
    color: $button-bg-hover;
    transform: translateY(-1px);
  }

  &:disabled {
    border-color: $disabled-bg;
    color: $disabled-text;
    background: transparent;
  }
}
</style>

