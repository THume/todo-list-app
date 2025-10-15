<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useTaskStore } from '../stores/useTaskStore';
import {
  getTodayDateString,
  normalizeTaskLists,
  resolveListId,
  recurrenceOptions,
} from '../composables/useTaskFormHelpers';

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
    return;
  }

  title.value = task.title ?? '';
  description.value = task.description ?? '';
  dueDate.value = formatDateInput(task.due);
  dueTime.value = formatTimeInput(task.due);
  recurrence.value = task.recurrence ?? 'none';
  lastTaskId.value = task.id ?? null;
  selectedListId.value = resolveListId(listOptions.value, task.listId);
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
      <div
        ref="panel"
        class="task-editor__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        tabindex="-1"
        @keydown.esc.prevent="handleCancel"
      >
        <header class="task-editor__header">
          <h2 id="task-editor-title">Edit Task</h2>
          <button
            type="button"
            class="task-editor__close"
            aria-label="Close editor"
            @click="handleCancel"
          >
            ├ù
          </button>
        </header>
        <form class="task-editor__form" @submit.prevent="handleSave">
          <label class="task-editor__field">
            <span class="task-editor__label">Title</span>
            <input
              ref="titleField"
              v-model="title"
              type="text"
              class="task-editor__input"
              name="title"
              required
              aria-required="true"
            />
          </label>
          <label class="task-editor__field">
            <span class="task-editor__label">Description</span>
            <textarea
              v-model="description"
              name="description"
              class="task-editor__textarea"
              rows="3"
            />
          </label>
          <label class="task-editor__field">
            <span class="task-editor__label">List</span>
            <select
              v-model="selectedListId"
              name="list"
              class="task-editor__input"
              aria-label="Task list"
              :disabled="listOptions.length === 0"
            >
              <option v-for="list in listOptions" :key="list.id" :value="list.id">
                {{ list.name }}
              </option>
            </select>
          </label>
          <div class="task-editor__row">
            <label class="task-editor__field">
              <span class="task-editor__label">Due date</span>
              <div class="task-editor__date-input-wrapper">
                <input
                  v-model="dueDate"
                  type="date"
                  name="dueDate"
                  class="task-editor__input task-editor__input--date"
                />
                <button
                  type="button"
                  class="task-editor__today-button"
                  @click="setDueDateToToday"
                >
                  Today
                </button>
              </div>
            </label>
            <label class="task-editor__field">
              <span class="task-editor__label">Due time</span>
              <input
                v-model="dueTime"
                type="time"
                name="dueTime"
                class="task-editor__input"
                :disabled="!dueDate"
              />
            </label>
          </div>
          <label class="task-editor__field">
            <span class="task-editor__label">Repeats</span>
            <select v-model="recurrence" name="recurrence" class="task-editor__input">
              <option
                v-for="option in recurrenceOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <footer class="task-editor__actions">
            <button
              type="button"
              class="task-editor__button task-editor__button--ghost"
              @click="handleCancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="task-editor__button task-editor__button--primary"
              :disabled="!canSave"
            >
              Save changes
            </button>
          </footer>
        </form>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

$dialog-backdrop: theme.$color-overlay-strong;
$dialog-panel-bg: theme.$color-surface-elevated;
$dialog-border: theme.$color-border-strong;
$input-border: theme.$color-border-input;
$input-bg: theme.$color-surface-base;
$input-bg-focus: theme.$color-surface-hover;
$input-text: theme.$color-text-primary;
$muted-text: theme.$color-text-muted;
$focus-outline: theme.$color-accent-focus-strong;
$accent: theme.$color-accent;
$accent-hover: theme.$color-accent-hover;
$ghost-hover: theme.$color-surface-ghost-strong;

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
  padding: 1.5rem;
  box-sizing: border-box;

  &__panel {
    width: min(100%, 34rem);
    background: $dialog-panel-bg;
    border-radius: 1rem;
    border: 1px solid $dialog-border;
    padding: 2rem;
    box-shadow: 0 28px 40px -32px rgba(0, 0, 0, 0.8);
    display: grid;
    gap: 1.5rem;
    outline: none;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;

    h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: $input-text;
    }
  }

  &__close {
    border: none;
    background: transparent;
    font-size: 1.5rem;
    line-height: 1;
    color: $muted-text;
    cursor: pointer;
    transition: color 0.2s ease, transform 0.2s ease;

    &:hover {
      color: $accent;
      transform: rotate(90deg);
    }

    &:focus-visible {
      outline: 2px solid $accent;
      outline-offset: 2px;
    }
  }

  &__form {
    display: grid;
    gap: 1rem;
  }

  &__field {
    display: grid;
    gap: 0.45rem;
  }

  &__label {
    font-size: 0.95rem;
    font-weight: 600;
    color: $input-text;
  }

  &__input,
  &__textarea {
    border: 1px solid $input-border;
    border-radius: 0.75rem;
    padding: 0.75rem 0.95rem;
    font-size: 1rem;
    font-family: inherit;
    background: $input-bg;
    color: $input-text;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

    &:focus {
      outline: none;
      border-color: $accent;
      box-shadow: 0 0 0 3px $focus-outline;
      background: $input-bg-focus;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__date-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__input--date {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__today-button {
    border: 1px solid $dialog-border;
    background: $input-bg;
    color: $input-text;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

    &:hover {
      background: $ghost-hover;
      border-color: $accent;
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 2px solid $accent;
      outline-offset: 2px;
    }
  }

  &__textarea {
    resize: vertical;
    min-height: 4rem;
  }

  &__row {
    display: grid;
    gap: 1rem;

    @media (min-width: 560px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  &__button {
    border-radius: 0.75rem;
    padding: 0.65rem 1.35rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;

    &:hover {
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 2px solid $accent;
      outline-offset: 2px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
      transform: none;
      box-shadow: none;
    }

    &--ghost {
      border: 1px solid $dialog-border;
      background: transparent;
      color: $input-text;

      &:hover {
        background: $ghost-hover;
        border-color: $accent;
      }
    }

    &--primary {
      border: none;
      background: $accent;
      color: theme.$color-text-inverted;
      box-shadow: 0 16px 28px -24px rgba(239, 68, 68, 0.85);

      &:hover:not(:disabled) {
        background: $accent-hover;
        box-shadow: 0 18px 32px -26px rgba(248, 113, 113, 0.9);
      }
    }
  }
}
</style>
