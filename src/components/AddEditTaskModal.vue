<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import {
  getTodayDateString,
  normalizeTaskLists,
  resolveListId,
  recurrenceOptions,
} from '../composables/useTaskFormHelpers';
import ModalBase from './ModalBase.vue';
import IconGlyph from './IconGlyph.vue';
import { useUiSettings } from '../stores/useUiSettings';

const props = defineProps({
  visible: {
    type: Boolean,
    default: true,
  },
  mode: {
    type: String,
    default: 'add',
    validator: (value) => ['add', 'edit', 'duplicate'].includes(value),
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
  task: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['submit', 'update:visible', 'save', 'cancel']);

const title = ref('');
const description = ref('');
const dueDate = ref('');
const dueTime = ref('');
const recurrence = ref('none');
const selectedListId = ref('');
const markCompleted = ref(false);
const reminderOffset = ref('none');
const isLongTerm = ref(false);
const startDate = ref('');
const { isLongTermTasksEnabled } = useUiSettings();
const titleField = ref(null);
const subtaskInput = ref('');
const appliedDefaultDueDate = ref(null);
const lastTaskId = ref(null);
const subtasks = ref([]);
const draggedSubtaskId = ref(null);
const dragOverSubtaskId = ref(null);
const showReminderWarning = ref(false);
let subtaskLocalId = 0;
let isApplyingDefaultDueDate = false;

const isEditMode = computed(() => props.mode === 'edit');
const isDuplicateMode = computed(() => props.mode === 'duplicate');

const setDueDateToToday = () => {
  dueDate.value = getTodayDateString();
  appliedDefaultDueDate.value = null;
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
  subtaskLocalId = 0;
  if (!task) {
    title.value = '';
    description.value = '';
    dueDate.value = '';
    dueTime.value = '';
    recurrence.value = 'none';
    lastTaskId.value = null;
    selectedListId.value = resolveListId(listOptions.value, null);
    reminderOffset.value = 'none';
    isLongTerm.value = false;
    startDate.value = '';
    subtasks.value = [];
    draggedSubtaskId.value = null;
    dragOverSubtaskId.value = null;
    return;
  }

  title.value = task.title ?? '';
  description.value = task.description ?? '';
  dueDate.value = formatDateInput(task.due);
  dueTime.value = formatTimeInput(task.due);
  recurrence.value = task.recurrence ?? 'none';
  lastTaskId.value = task.id ?? null;
  selectedListId.value = resolveListId(listOptions.value, task.listId);
  isLongTerm.value = Boolean(task.isLongTerm);
  startDate.value = formatDateInput(task.startDate);
  subtaskInput.value = '';
  const mappedSubtasks = Array.isArray(task.subtasks)
    ? task.subtasks
        .filter((entry) => typeof entry?.title === 'string' && entry.title.trim().length > 0)
        .map((entry) => ({
          id: entry.id ?? `local-${++subtaskLocalId}`,
          title: entry.title.trim(),
          completed: isDuplicateMode.value ? false : Boolean(entry.completed),
        }))
    : [];
  subtasks.value = mappedSubtasks;
  draggedSubtaskId.value = null;
  dragOverSubtaskId.value = null;

  const minutes = Number(task.reminderOffsetMinutes);
  if (Number.isFinite(minutes) && minutes > 0 && task.due) {
    reminderOffset.value = String(minutes);
  } else {
    reminderOffset.value = 'none';
  }
};

const listOptions = computed(() => normalizeTaskLists(props.lists));

const selectedList = computed(() => {
  if (!selectedListId.value) {
    return null;
  }
  return listOptions.value.find((list) => list.id === selectedListId.value) ?? null;
});

const canSubmit = computed(() => title.value.trim().length > 0);

const dialogTitle = computed(() => isEditMode.value ? 'Edit Task' : 'Add a Task');
const submitButtonText = computed(() => isEditMode.value ? 'Save changes' : 'Add Task');
const titleIcon = computed(() => isEditMode.value ? 'edit' : 'plus');
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
const hasSubtasks = computed(() => subtasks.value.length > 0);
const canAddSubtask = computed(() => subtaskInput.value.trim().length > 0);

const resetForm = () => {
  title.value = '';
  description.value = '';
  dueTime.value = '';
  recurrence.value = 'none';
  markCompleted.value = false;
  reminderOffset.value = 'none';
  isLongTerm.value = false;
  startDate.value = '';
  lastTaskId.value = null;
  subtasks.value = [];
  draggedSubtaskId.value = null;
  dragOverSubtaskId.value = null;
  subtaskLocalId = 0;
  subtaskInput.value = '';
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

  // Check if reminder is set but no due date
  if (reminderOffset.value !== 'none' && !dueDate.value) {
    showReminderWarning.value = true;
    return;
  }
  
  showReminderWarning.value = false;

  const sanitizedSubtasks = subtasks.value
    .map((entry) => ({
      ...entry,
      title: typeof entry.title === 'string' ? entry.title.trim() : '',
    }))
    .filter((entry) => entry.title.length > 0);

  if (isEditMode.value) {
    // Edit mode
    if (!props.task) {
      return;
    }
    emit('save', {
      id: props.task.id,
      title: trimmedTitle,
      description: description.value.trim(),
      dueDate: dueDate.value || null,
      dueTime: isLongTerm.value ? null : (dueTime.value || null),
      recurrence: recurrence.value,
      listId: selectedListId.value || null,
      reminderOffsetMinutes: reminderOffset.value === 'none' ? null : Number(reminderOffset.value),
      subtasks: sanitizedSubtasks,
      isLongTerm: isLongTerm.value,
      startDate: startDate.value || null,
    });
    closeModal();
  } else {
    // Add mode
    emit('submit', {
      title: trimmedTitle,
      description: description.value.trim(),
      dueDate: dueDate.value || null,
      dueTime: isLongTerm.value ? null : (dueTime.value || null),
      recurrence: recurrence.value,
      listId: selectedListId.value || null,
      completed: markCompleted.value,
      reminderOffsetMinutes: reminderOffset.value === 'none' ? null : Number(reminderOffset.value),
      subtasks: sanitizedSubtasks.map((entry) => ({ ...entry, completed: false })),
      isLongTerm: isLongTerm.value,
      startDate: startDate.value || null,
    });

    if (shouldCloseModal) {
      emit('update:visible', false);
      return;
    }

    resetForm();

    nextTick(() => {
      titleField.value?.focus();
    });
  }
};

const addSubtask = (titleValue) => {
  const trimmed = typeof titleValue === 'string' ? titleValue.trim() : '';
  if (!trimmed) {
    return;
  }
  subtasks.value = [
    ...subtasks.value,
    {
      id: `local-${++subtaskLocalId}`,
      title: trimmed,
      completed: false,
    },
  ];
};

const removeSubtask = (id) => {
  subtasks.value = subtasks.value.filter((entry) => entry.id !== id);
};

const toggleSubtask = (id) => {
  subtasks.value = subtasks.value.map((entry) =>
    entry.id === id ? { ...entry, completed: !entry.completed } : entry
  );
};

const moveSubtask = (sourceId, targetId) => {
  if (!sourceId || !targetId || sourceId === targetId) {
    return;
  }
  const current = [...subtasks.value];
  const sourceIndex = current.findIndex((entry) => entry.id === sourceId);
  const targetIndex = current.findIndex((entry) => entry.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }
  const [moving] = current.splice(sourceIndex, 1);
  const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  current.splice(insertIndex, 0, moving);
  subtasks.value = current;
};

const handleSubtaskDragStart = (subtask, event) => {
  if (!subtask?.id) {
    return;
  }
  draggedSubtaskId.value = subtask.id;
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', subtask.id);
  }
};

const handleSubtaskDragEnter = (subtask) => {
  if (!draggedSubtaskId.value || !subtask?.id) {
    return;
  }
  if (subtask.id === draggedSubtaskId.value) {
    return;
  }
  dragOverSubtaskId.value = subtask.id;
};

const handleSubtaskDrop = (subtask) => {
  if (!draggedSubtaskId.value || !subtask?.id) {
    return;
  }
  moveSubtask(draggedSubtaskId.value, subtask.id);
  draggedSubtaskId.value = null;
  dragOverSubtaskId.value = null;
};

const handleSubtaskDragEnd = () => {
  draggedSubtaskId.value = null;
  dragOverSubtaskId.value = null;
};

const closeModal = () => {
  emit('update:visible', false);
  if (isEditMode.value || isDuplicateMode.value) {
    emit('cancel');
  }
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
  window.addEventListener('keydown', handleKeydown);
};

const unregisterKeydown = () => {
  window.removeEventListener('keydown', handleKeydown);
};

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      registerKeydown();
      if ((isEditMode.value || isDuplicateMode.value) && props.task) {
        applyTask(props.task);
      }
      nextTick(() => titleField.value?.focus());
    } else {
      unregisterKeydown();
      if (!isEditMode.value) {
        resetForm();
      }
    }
  },
  { immediate: true }
);

watch(
  () => props.task,
  (task) => {
    if (!props.visible || !isEditMode.value) {
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

  // Clear warning if due date is now set
  if (value && showReminderWarning.value) {
    showReminderWarning.value = false;
  }

  if (!isEditMode.value && !isApplyingDefaultDueDate && appliedDefaultDueDate.value && value !== appliedDefaultDueDate.value) {
    appliedDefaultDueDate.value = null;
  }
});

watch(selectedListId, () => {
  // Only apply default reminder in add mode (not edit or duplicate)
  if (isEditMode.value || isDuplicateMode.value) {
    return;
  }

  // Apply the list's default reminder if it has one
  if (selectedList.value?.defaultReminderOffsetMinutes) {
    const minutes = Number(selectedList.value.defaultReminderOffsetMinutes);
    if (Number.isFinite(minutes) && minutes > 0) {
      reminderOffset.value = String(minutes);
      return;
    }
  }
  
  // Otherwise reset to none
  reminderOffset.value = 'none';
});

watch(reminderOffset, (value) => {
  // Clear warning if reminder is set to none
  if (value === 'none' && showReminderWarning.value) {
    showReminderWarning.value = false;
  }
});

watch(isLongTerm, (value) => {
  // When switching to long-term mode, clear time, recurrence, and reminder
  if (value) {
    dueTime.value = '';
    recurrence.value = 'none';
    reminderOffset.value = 'none';
  }
  // When switching from long-term to regular, clear start date
  if (!value) {
    startDate.value = '';
  }
});

watch(
  () => props.defaultDueDate,
  (newDefault, oldDefault) => {
    if (isEditMode.value) {
      return;
    }

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
  <Teleport v-if="visible" to="body">
    <ModalBase
      :open="visible"
      size="large"
      :title="dialogTitle"
      @update:open="$emit('update:visible', $event)"
      @close="closeModal"
    >
      <template #default>
        <form id="add-task-form" class="add-task__form" @submit.prevent="handleSubmit(true)">
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
                name="edit"
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
            <div v-if="isLongTermTasksEnabled" class="add-task__long-term">
              <label class="add-task__checkbox">
                <input
                  v-model="isLongTerm"
                  type="checkbox"
                  class="add-task__checkbox-input"
                  name="longTerm"
                  aria-label="This is a long-term task"
                />
                <span class="add-task__checkbox-box" aria-hidden="true">
                  <IconGlyph
                    v-if="isLongTerm"
                    name="check"
                    size="14"
                    class="add-task__checkbox-icon"
                  />
                </span>
                <span class="add-task__checkbox-label">This is a long-term task</span>
              </label>
              <p class="add-task__checkbox-hint">
                Long-term tasks have a start date and deadline, with no specific time.
              </p>
            </div>
            <div class="add-task__due-row">
              <label v-if="isLongTerm" class="add-task__due-label">
                <span class="add-task__label-heading">
                  <IconGlyph
                    name="calendar"
                    size="14"
                    class="add-task__label-icon"
                    aria-hidden="true"
                  />
                  <span>Start date</span>
                </span>
                <input
                  v-model="startDate"
                  type="date"
                  name="startDate"
                  class="add-task__due-input"
                  aria-label="Start date"
                />
              </label>
              <label class="add-task__due-label">
                <span class="add-task__label-heading">
                  <IconGlyph
                    name="calendar"
                    size="14"
                    class="add-task__label-icon"
                    aria-hidden="true"
                  />
                  <span>{{ isLongTerm ? 'Deadline' : 'Due date' }}</span>
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
              <label v-if="!isLongTerm" class="add-task__due-label">
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
            <label v-if="!isLongTerm" class="add-task__due-label add-task__reminder">
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
                :class="{ 'add-task__select--error': showReminderWarning }"
                aria-label="Reminder time"
                :disabled="!dueDate"
              >
                <option v-for="option in reminderOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <p v-if="showReminderWarning" class="add-task__warning">
                Please set a due date to use reminders
              </p>
            </label>
            <div class="add-task__subtasks">
              <div class="add-task__subtasks-header">
                <span class="add-task__label-heading">
                  <IconGlyph
                    name="check"
                    size="14"
                    class="add-task__label-icon"
                    aria-hidden="true"
                  />
                  <span>Subtasks</span>
                </span>
              </div>
              <div class="add-task__subtask-input-row">
                <input
                  v-model="subtaskInput"
                  type="text"
                  class="add-task__subtask-input"
                  name="subtask"
                  autocomplete="off"
                  placeholder="Add a subtask title"
                  aria-label="Add a subtask"
                  @keydown.enter.prevent="addSubtask(subtaskInput); subtaskInput = ''"
                />
                <button
                  type="button"
                  class="add-task__subtask-button"
                  :disabled="!canAddSubtask"
                  @click="addSubtask(subtaskInput); subtaskInput = ''"
                >
                  Add
                </button>
              </div>
              <ul v-if="hasSubtasks" class="add-task__subtask-list">
                <li
                  v-for="subtask in subtasks"
                  :key="subtask.id"
                  class="add-task__subtask"
                  :class="{
                    'add-task__subtask--drag-over': dragOverSubtaskId === subtask.id,
                    'add-task__subtask--dragging': draggedSubtaskId === subtask.id,
                  }"
                  draggable="true"
                  @dragstart="handleSubtaskDragStart(subtask, $event)"
                  @dragenter="handleSubtaskDragEnter(subtask)"
                  @dragover.prevent
                  @drop.prevent="handleSubtaskDrop(subtask)"
                  @dragend="handleSubtaskDragEnd"
                >
                  <span class="add-task__subtask-handle" aria-hidden="true">::</span>
                  <label class="add-task__subtask-label">
                    <input
                      type="checkbox"
                      class="add-task__subtask-checkbox"
                      :checked="subtask.completed"
                      @change="toggleSubtask(subtask.id)"
                    />
                    <span
                      :class="[
                        'add-task__subtask-title',
                        { 'add-task__subtask-title--completed': subtask.completed },
                      ]"
                    >
                      {{ subtask.title }}
                    </span>
                  </label>
                  <button
                    type="button"
                    class="add-task__subtask-remove"
                    aria-label="Remove subtask"
                    @click="removeSubtask(subtask.id)"
                  >
                    &times;
                  </button>
                </li>
              </ul>
            </div>
            <label v-if="!isLongTerm" class="add-task__due-label add-task__recurrence">
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
            <div v-if="!isEditMode" class="add-task__completion">
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
        </form>
      </template>

      <template #actions>
        <div class="add-task__actions">
          <button
            type="submit" 
            class="add-task__submit" 
            form="add-task-form" 
            :disabled="!canSubmit"
          >
            <IconGlyph
              :name="isEditMode ? 'check' : 'plus'"
              size="16"
              class="add-task__submit-icon"
              aria-hidden="true"
            />
            {{ submitButtonText }}
          </button>
          <button
            v-if="!isEditMode"
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
      </template>
    </ModalBase>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

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
$panel-border: rgba(255, 255, 255, 0.08);



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

  /* Better touch targets on mobile */
  @media (max-width: 768px) {
    padding: 0.95rem 1rem;
  }

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

.add-task__field-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: theme.$color-text-muted;
}

.add-task__input-shell-group {
  display: grid;
  gap: 0.5rem;
}

.add-task__tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.add-task__chip {
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

.add-task__input-shell--split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
}

.add-task__input-shell--row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.add-task__input-shell--chips {
  display: grid;
  gap: 0.75rem;
}

.add-task__input-shell--time {
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
}

.add-task__input-shell--list {
  grid-template-columns: 1fr auto;
  align-items: end;
}

.add-task__input-shell--list .add-task__select {
  max-width: 16rem;
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

.add-task__completion {
  display: grid;
  gap: 0.35rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid $input-border;
  border-radius: 1rem;
  background: $input-bg;
}

.add-task__checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  user-select: none;
  color: $input-text;
  font-weight: 600;

  @media (max-width: 768px) {
    gap: 0.75rem;
    padding: 0.5rem 0;
  }
}

.add-task__checkbox-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.add-task__checkbox-box {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 0.4rem;
  border: 2px solid $checkbox-border;
  background: $checkbox-bg;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

  @media (max-width: 768px) {
    width: 1.375rem;
    height: 1.375rem;
  }
}

.add-task__checkbox-icon {
  color: $checkbox-icon;
}

.add-task__checkbox-input:focus-visible + .add-task__checkbox-box {
  outline: 2px solid $focus-outline;
  outline-offset: 3px;
}

.add-task__checkbox-input:checked + .add-task__checkbox-box {
  background: $checkbox-checked-bg;
  border-color: $checkbox-checked-border;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
}

.add-task__checkbox-label {
  font-size: 0.95rem;
}

.add-task__checkbox-hint {
  margin: 0;
  color: theme.$color-text-muted;
  font-size: 0.85rem;
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

  /* Larger touch target on mobile */
  @media (max-width: 768px) {
    padding: 0.85rem 1rem;
    font-size: 1.05rem;
  }

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

  /* Larger touch target on mobile */
  @media (max-width: 768px) {
    padding: 0.9rem 1rem;
    font-size: 1.05rem;
  }

  &:focus {
    outline: none;
    border-color: $button-bg;
    box-shadow: 0 0 0 3px $focus-outline;
    background: $input-bg-focus;
  }

  &--error {
    border-color: theme.$color-accent;
    box-shadow: 0 0 0 3px theme.$color-accent-focus-soft;
  }
}

.add-task__warning {
  margin: 0;
  padding: 0.5rem 0;
  color: theme.$color-accent;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.4;
}

.add-task__today-button {
  border: 1px solid $panel-border;
  background: $input-bg;
  color: $input-text;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.45rem 0.85rem;
  border-radius: 0.65rem;
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

.add-task__chip-icon {
  margin-right: 0.35rem;
  color: theme.$color-accent;
}

.add-task__subtasks {
  display: grid;
  gap: 0.65rem;
  padding: 0.9rem 0.95rem;
  border: 1px solid $input-border;
  border-radius: 1rem;
  background: $input-bg;
}

.add-task__subtasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.add-task__subtask-input-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.add-task__subtask-input {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid $input-border;
  border-radius: 0.65rem;
  padding: 0.6rem 0.75rem;
  background: $input-bg;
  color: $input-text;

  &:focus-visible {
    outline: 2px solid $focus-outline;
    outline-offset: 2px;
    border-color: $button-bg;
    background: $input-bg-focus;
  }

  @media (max-width: 768px) {
    padding: 0.85rem 1rem;
    font-size: 1.05rem;
  }
}

.add-task__subtask-button {
  border: 1px solid $button-bg;
  background: rgba(239, 68, 68, 0.12);
  color: $button-bg;
  font-weight: 700;
  padding: 0.55rem 1rem;
  border-radius: 0.65rem;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: 0.75rem 1.25rem;
    font-size: 1rem;
    min-height: 44px;
  }
}

.add-task__subtask-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
}

.add-task__subtask {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.4rem;
  border-radius: 0.65rem;
  cursor: grab;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.add-task__subtask--drag-over {
  border-color: $button-bg;
  background: rgba(239, 68, 68, 0.12);
}

.add-task__subtask--dragging {
  opacity: 0.7;
  cursor: grabbing;
}

.add-task__subtask-label {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  flex: 1 1 auto;
  color: $input-text;
  font-weight: 600;
}

.add-task__subtask-handle {
  color: theme.$color-text-muted;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: grab;
  user-select: none;
}

.add-task__subtask-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: $button-bg;
}

.add-task__subtask-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.add-task__subtask-title--completed {
  text-decoration: line-through;
  color: theme.$color-text-muted;
}

.add-task__subtask-remove {
  border: 1px solid $panel-border;
  background: transparent;
  color: $input-text;
  width: 2rem;
  height: 2rem;
  border-radius: 0.65rem;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    border-color: $button-bg;
    color: $button-bg;
    background: rgba(239, 68, 68, 0.15);
  }

  &:focus-visible {
    outline: 2px solid $focus-outline;
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1.15rem;
  }
}



.add-task__submit-icon {
  margin-right: 0.5rem;
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

  @media (max-width: 768px) {
    width: 100%;
    justify-self: stretch;
    text-align: center;
    padding: 0.9rem 1.5rem;
    font-size: 1.05rem;
    min-height: 44px;
  }
}

.add-task__actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
  align-items: center;
  padding: 1.75rem;
  margin: 0 -1.75rem -1.75rem -1.75rem;
  border-top: 1px solid $input-border;
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
