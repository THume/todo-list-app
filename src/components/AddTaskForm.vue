<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import {
  getTodayDateString,
  normalizeTaskLists,
  resolveListId,
  recurrenceOptions,
} from '../composables/useTaskFormHelpers';

const props = defineProps({
  visible: {
    type: Boolean,
    default: true,
  },
  defaultDueDate: {
    type: String,
    default: null,
  },
  lists: {
    type: Array,
    default: () => [],
  },
  defaultListId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['submit', 'update:visible']);

const title = ref('');
const description = ref('');
const dueDate = ref('');
const dueTime = ref('');
const recurrence = ref('none');
const selectedListId = ref('');
const titleField = ref(null);
const appliedDefaultDueDate = ref(null);
let isApplyingDefaultDueDate = false;
const setDueDateToToday = () => {
  dueDate.value = getTodayDateString();
  appliedDefaultDueDate.value = null;
};

const listOptions = computed(() => normalizeTaskLists(props.lists));

const canSubmit = computed(() => title.value.trim().length > 0);

const toggleVisibility = () => {
  emit('update:visible', !props.visible);
};

const resetForm = () => {
  title.value = '';
  description.value = '';
  dueTime.value = '';
  recurrence.value = 'none';
  if (props.defaultDueDate) {
    isApplyingDefaultDueDate = true;
    dueDate.value = props.defaultDueDate;
    appliedDefaultDueDate.value = props.defaultDueDate;
    nextTick(() => {
      isApplyingDefaultDueDate = false;
    });
  } else {
    dueDate.value = '';
    appliedDefaultDueDate.value = null;
  }
};

const handleSubmit = () => {
  const trimmedTitle = title.value.trim();

  if (!trimmedTitle) {
    return;
  }

  emit('submit', {
    title: trimmedTitle,
    description: description.value.trim(),
    dueDate: dueDate.value || null,
    dueTime: dueTime.value || null,
    recurrence: recurrence.value,
    listId: selectedListId.value || null,
  });

  resetForm();

  nextTick(() => {
    titleField.value?.focus();
  });
};

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      nextTick(() => titleField.value?.focus());
    }
  },
  { immediate: true }
);

watch(
  [() => listOptions.value, () => props.defaultListId],
  ([options, defaultId]) => {
    if (!options.length) {
      selectedListId.value = '';
      return;
    }
    const preferred = defaultId ?? selectedListId.value;
    selectedListId.value = resolveListId(options, preferred);
  },
  { immediate: true }
);

watch(dueDate, (value) => {
  if (!value) {
    dueTime.value = '';
  }

  if (!isApplyingDefaultDueDate && appliedDefaultDueDate.value && value !== appliedDefaultDueDate.value) {
    appliedDefaultDueDate.value = null;
  }
});

watch(
  () => props.defaultDueDate,
  (newDefault, oldDefault) => {
    if (!newDefault) {
      if (oldDefault && dueDate.value === oldDefault) {
        dueDate.value = '';
      }
      appliedDefaultDueDate.value = null;
      return;
    }

    const previousApplied = appliedDefaultDueDate.value;
    const becameActive = !oldDefault && !!newDefault;
    const shouldApply = becameActive || !dueDate.value || dueDate.value === previousApplied;

    appliedDefaultDueDate.value = newDefault;

    if (shouldApply) {
      isApplyingDefaultDueDate = true;
      dueDate.value = newDefault;
      nextTick(() => {
        isApplyingDefaultDueDate = false;
      });
    }
  },
  { immediate: true }
);
</script>

<template>
  <section class="add-task">
    <header class="add-task__header">
      <h1 class="add-task__title">Add a Task</h1>
      <button
        type="button"
        class="add-task__toggle"
        :aria-expanded="visible"
        @click="toggleVisibility"
      >
        {{ visible ? 'Hide form' : 'Show form' }}
      </button>
    </header>
    <form v-show="visible" class="add-task__form" @submit.prevent="handleSubmit">
      <div class="add-task__fields">
        <input
          ref="titleField"
          v-model="title"
          type="text"
          class="add-task__input"
          name="title"
          autocomplete="off"
          placeholder="Task title"
          aria-label="Task title"
          required
        />
        <textarea
          v-model="description"
          class="add-task__textarea"
          name="description"
          placeholder="Description (optional)"
          aria-label="Task description"
          rows="2"
        />
        <label class="add-task__due-label add-task__list">
          <span>List</span>
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
            <span>Due date</span>
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
            <span>Due time</span>
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
          <span>Repeats</span>
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
      </div>
      <button type="submit" class="add-task__submit" :disabled="!canSubmit">Add Task</button>
    </form>
  </section>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

$panel-bg: theme.$color-surface-elevated;
$panel-border: theme.$color-border-strong;
$input-border: theme.$color-border-input;
$input-bg: theme.$color-surface-base;
$input-bg-focus: theme.$color-surface-hover;
$focus-outline: theme.$color-accent-focus-soft;
$input-text: theme.$color-text-primary;
$muted-text: theme.$color-text-muted;
$disabled-bg: theme.$color-surface-disabled;
$disabled-text: theme.$color-text-disabled;
$button-bg: theme.$color-accent;
$button-bg-hover: theme.$color-accent-hover;

.add-task {
  background: $panel-bg;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 20px 25px -20px rgba(2, 6, 23, 0.55);
  border: 1px solid $panel-border;
  display: grid;
  gap: 1.25rem;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    @media (max-width: 640px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
  }

  &__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: $input-text;
  }

  &__form {
    display: grid;
    gap: 1.25rem;
  }

  &__fields {
    display: grid;
    gap: 0.75rem;
  }

  &__due-row {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: minmax(0, 1fr);
  }

  &__input,
  &__textarea,
  &__due-input {
    width: 100%;
    border: 1px solid $input-border;
    border-radius: 0.75rem;
    padding: 0.75rem 0.9rem;
    font-size: 1rem;
    font-family: inherit;
    background: $input-bg;
    color: $input-text;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: $button-bg;
      box-shadow: 0 0 0 3px $focus-outline;
      background: $input-bg-focus;
    }
  }

  &__textarea {
    resize: vertical;
    min-height: 3.5rem;
  }

  &__due-input {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__due-label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9rem;
    color: $muted-text;
  }

  &__due-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__recurrence {
    max-width: 16rem;
  }

  &__list {
    max-width: 16rem;
  }

  &__select {
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

  &__today-button {
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

  &__toggle {
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

  &__submit {
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
}
</style>
