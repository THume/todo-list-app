<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import {
  getTodayDateString,
  normalizeTaskLists,
  resolveListId,
  recurrenceOptions,
} from '../composables/useTaskFormHelpers';
import IconGlyph from './IconGlyph.vue';

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
const markCompleted = ref(false);
const reminderOffset = ref('none');
const titleField = ref(null);
const appliedDefaultDueDate = ref(null);
let isApplyingDefaultDueDate = false;
const setDueDateToToday = () => {
  dueDate.value = getTodayDateString();
  appliedDefaultDueDate.value = null;
};

const listOptions = computed(() => normalizeTaskLists(props.lists));

const canSubmit = computed(() => title.value.trim().length > 0);
const reminderOptions = [
  { value: 'none', label: 'No reminder' },
  { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '240', label: '4 hours before' },
  { value: '1440', label: '1 day before' },
];

const resetForm = () => {
  title.value = '';
  description.value = '';
  dueTime.value = '';
  recurrence.value = 'none';
  markCompleted.value = false;
  reminderOffset.value = 'none';
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

const handleSubmit = (shouldCloseModal = false) => {
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
    completed: markCompleted.value,
    reminderOffsetMinutes: reminderOffset.value === 'none' ? null : Number(reminderOffset.value),
  });

  if (shouldCloseModal) {
    emit('update:visible', false);
    return;
  }

  resetForm();

  nextTick(() => {
    titleField.value?.focus();
  });
};

const closeModal = () => {
  emit('update:visible', false);
};

const handleBackdropClick = () => {
  closeModal();
};

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
  }
};

const registerKeydown = () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown);
  }
};

const unregisterKeydown = () => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown);
  }
};

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      registerKeydown();
      nextTick(() => titleField.value?.focus());
    } else {
      unregisterKeydown();
      resetForm();
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  unregisterKeydown();
});

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
    reminderOffset.value = 'none';
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
  <Teleport to="body">
    <div
      v-if="visible"
      class="add-task-modal"
      role="presentation"
      @click.self="handleBackdropClick"
    >
      <section
        class="add-task"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-title"
      >
        <header class="add-task__header">
          <h1 id="add-task-title" class="add-task__title">
            <IconGlyph
              name="plus"
              size="18"
              class="add-task__title-icon"
              aria-hidden="true"
            />
            Add a Task
          </h1>
          <button
            type="button"
            class="add-task__close"
            aria-label="Close add task form"
            @click="closeModal"
          >
            &times;
          </button>
        </header>
        <form class="add-task__form" @submit.prevent="handleSubmit(true)">
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
                <option v-for="option in reminderOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
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
            <div class="add-task__completion">
              <label class="add-task__checkbox">
                <input
                  v-model="markCompleted"
                  type="checkbox"
                  class="add-task__checkbox-input"
                  name="completed"
                  aria-label="Mark task as completed"
                />
                <span class="add-task__checkbox-box" aria-hidden="true">
                  <IconGlyph
                    v-if="markCompleted"
                    name="check"
                    size="14"
                    class="add-task__checkbox-icon"
                  />
                </span>
                <span class="add-task__checkbox-label">Mark as completed</span>
              </label>
              <p class="add-task__checkbox-hint">
                Saves this task directly to completed history.
              </p>
            </div>
          </div>
          <div class="add-task__actions">
            <button type="submit" class="add-task__submit" :disabled="!canSubmit">
              <IconGlyph
                name="plus"
                size="16"
                class="add-task__submit-icon"
                aria-hidden="true"
              />
              Add Task
            </button>
            <button
              type="button"
              class="add-task__submit add-task__submit--secondary"
              :disabled="!canSubmit"
              @click="handleSubmit(false)"
            >
              <IconGlyph
                name="plus"
                size="16"
                class="add-task__submit-icon"
                aria-hidden="true"
              />
              Add and Start Another
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

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
$remove-hover: #f87171;

.add-task-modal {
  position: fixed;
  inset: 0;
  background: rgba(5, 5, 6, 0.75);
  backdrop-filter: blur(8px);
  padding: 3rem 1.5rem;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  z-index: 1000;

  @media (max-width: 640px) {
    padding: 1.5rem 0.75rem;
    align-items: stretch;
  }
}

.add-task {
  border: 1px solid $panel-border;
  border-radius: 1.5rem;
  padding: 1.5rem;
  background: $panel-bg;
  display: grid;
  gap: 1rem;
  width: min(640px, 100%);
  box-shadow: 0 32px 65px -40px rgba(0, 0, 0, 0.9);

  @media (max-width: 640px) {
    border-radius: 1.25rem;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__close {
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
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }

    &:focus-visible {
      outline: 2px solid $focus-outline;
      outline-offset: 2px;
    }
  }

  &__form {
    display: grid;
    gap: 1.5rem;
  }

  &__fields {
    display: grid;
    gap: 1.25rem;
  }

  &__input-shell {
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

  &__input-shell--textarea {
    align-items: flex-start;
  }

  &__field-icon {
    color: theme.$color-accent;
    margin-top: 0.05rem;
  }

  &__input,
  &__textarea {
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

  &__textarea {
    resize: vertical;
    min-height: 4.25rem;
  }

  &__field-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: theme.$color-text-muted;
  }

  &__input-shell-group {
    display: grid;
    gap: 0.5rem;
  }

  &__tags {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  &__chip {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: theme.$color-text-primary;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  &__input-shell--split {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.75rem;
  }

  &__input-shell--row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  &__input-shell--chips {
    display: grid;
    gap: 0.75rem;
  }

  &__input-shell--time {
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  }

  &__input-shell--list {
    grid-template-columns: 1fr auto;
    align-items: end;
  }

  &__input-shell--list .add-task__select {
    max-width: 16rem;
  }

  &__label-heading {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 700;
    font-size: 0.95rem;
    color: $input-text;
  }

  &__label-icon {
    color: theme.$color-text-muted;
  }

  &__list,
  &__recurrence,
  &__due-label {
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

  &__due-row {
    display: grid;
    gap: 0.75rem;

    @media (min-width: 640px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__completion {
    display: grid;
    gap: 0.35rem;
    padding: 0.8rem 0.95rem;
    border: 1px solid $input-border;
    border-radius: 1rem;
    background: $input-bg;
  }

  &__checkbox {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    cursor: pointer;
    user-select: none;
    color: $input-text;
    font-weight: 600;
  }

  &__checkbox-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  &__checkbox-box {
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 0.4rem;
    border: 2px solid $checkbox-border;
    background: $checkbox-bg;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  }

  &__checkbox-icon {
    color: $checkbox-icon;
  }

  &__checkbox-input:focus-visible + &__checkbox-box {
    outline: 2px solid $focus-outline;
    outline-offset: 3px;
  }

  &__checkbox-input:checked + &__checkbox-box {
    background: $checkbox-checked-bg;
    border-color: $checkbox-checked-border;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
  }

  &__checkbox-label {
    font-size: 0.95rem;
  }

  &__checkbox-hint {
    margin: 0;
    color: theme.$color-text-muted;
    font-size: 0.85rem;
  }

  &__due-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  &__due-input {
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

  &__chip-icon {
    margin-right: 0.35rem;
    color: theme.$color-accent;
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

  &__title-icon {
    color: theme.$color-accent;
  }

  &__submit-icon {
    margin-right: 0.5rem;
  }

  &__actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.75rem;
    align-items: center;
  }

  &__submit--secondary {
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
}
</style>
