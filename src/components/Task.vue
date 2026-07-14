<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import IconGlyph from './IconGlyph.vue';
import ConfirmDialog from './ConfirmDialog.vue';

const emit = defineEmits([
  'toggle',
  'remove',
  'edit',
  'duplicate',
  'move-to-today',
  'move-to-tomorrow',
  'move-to-next-week',
  'worked-on',
  'long-term-worked-on',
  'skip-recurrence',
  'adjust-completion-date',
  'edit-completion-notes',
  'toggle-subtask',
]);

const props = defineProps({
  task: {
    type: Object,
    required: true,
    validator(value) {
      const hasTitle = typeof value.title === 'string' && value.title.trim().length > 0;
      const hasCompletedFlag = typeof value.completed === 'boolean';
      return hasTitle && hasCompletedFlag;
    },
  },
  listName: {
    type: String,
    default: '',
  },
  isCompletedPage: {
    type: Boolean,
    default: false,
  },
  completedDate: {
    type: String,
    default: '',
  },
  showWorkedOnAction: {
    type: Boolean,
    default: false,
  },
  workedOnActionLabel: {
    type: String,
    default: '',
  },
});

const dueDate = computed(() => {
  if (!props.task.due) {
    return null;
  }

  const date = new Date(props.task.due);
  return Number.isNaN(date.getTime()) ? null : date;
});

const formattedDueDate = computed(() => {
  if (!dueDate.value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: dueDate.value.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(dueDate.value);
});

const formattedDueTime = computed(() => {
  if (!dueDate.value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(dueDate.value);
});

const shouldShowDueTime = computed(() => {
  if (!formattedDueTime.value || !dueDate.value) {
    return false;
  }

  const hours = dueDate.value.getHours();
  const minutes = dueDate.value.getMinutes();

  return !(hours === 23 && minutes === 59);
});

const dueDateIso = computed(() => (dueDate.value ? dueDate.value.toISOString() : ''));

const formattedDueLabel = computed(() => {
  if (!formattedDueDate.value) {
    return '';
  }

  if (!shouldShowDueTime.value) {
    return formattedDueDate.value;
  }

  return `${formattedDueDate.value} at ${formattedDueTime.value}`;
});

const recurrenceLabel = computed(() => {
  const suffix = props.task?.recurrenceAnchor === 'completion'
    ? ' after completion'
    : ' after due date';

  switch (props.task.recurrence) {
    case 'daily':
      return `Repeats daily${suffix}`;
    case 'every2days':
      return `Repeats every 2 days${suffix}`;
    case 'weekdays':
      return `Repeats on weekdays${suffix}`;
    case 'weekly':
      return `Repeats weekly${suffix}`;
    case 'biweekly':
      return `Repeats every 2 weeks${suffix}`;
    case 'monthly':
      return `Repeats monthly${suffix}`;
    case 'quarterly':
      return `Repeats every 3 months${suffix}`;
    case 'semiannual':
      return `Repeats every 6 months${suffix}`;
    case 'yearly':
      return `Repeats yearly${suffix}`;
    default:
      return '';
  }
});

const reminderLabel = computed(() => {
  const minutes = Number(props.task?.reminderOffsetMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '';
  }
  if (minutes % 1440 === 0) {
    const days = Math.round(minutes / 1440);
    return `${days} day${days === 1 ? '' : 's'} before`;
  }
  if (minutes % 60 === 0 && minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} before`;
  }
  return `${minutes} minutes before`;
});

const priorityLabel = computed(() => {
  switch (props.task?.priority) {
    case 'low':
      return 'Low priority';
    case 'medium':
      return 'Medium priority';
    case 'high':
      return 'High priority';
    default:
      return '';
  }
});

const isLongTerm = computed(() => Boolean(props.task?.isLongTerm));

const startDateObj = computed(() => {
  if (!props.task?.startDate) {
    return null;
  }

  const date = new Date(props.task.startDate);
  return Number.isNaN(date.getTime()) ? null : date;
});

const formattedStartDate = computed(() => {
  if (!startDateObj.value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: startDateObj.value.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(startDateObj.value);
});

const deadlineDate = computed(() => {
  // For long-term tasks, use the due field as the deadline
  if (!isLongTerm.value || !props.task.due) {
    return null;
  }

  const date = new Date(props.task.due);
  return Number.isNaN(date.getTime()) ? null : date;
});

const formattedDeadline = computed(() => {
  if (!deadlineDate.value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: deadlineDate.value.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(deadlineDate.value);
});

const daysRemaining = computed(() => {
  if (!deadlineDate.value) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const deadline = new Date(deadlineDate.value);
  deadline.setHours(0, 0, 0, 0);
  
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

const daysRemainingLabel = computed(() => {
  const days = daysRemaining.value;
  
  if (days === null) {
    return '';
  }
  
  if (days < 0) {
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  }
  
  if (days === 0) {
    return 'Due today';
  }
  
  if (days === 1) {
    return '1 day remaining';
  }
  
  return `${days} days remaining`;
});

const listLabel = computed(() => {
  const raw = props.listName;
  if (typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  return trimmed;
});
const menuOpen = ref(false);
const menuButton = ref(null);
const menuPanel = ref(null);
const isDescriptionExpanded = ref(false);
const descriptionEl = ref(null);
const canToggleDescription = ref(false);
const subtasks = computed(() =>
  Array.isArray(props.task?.subtasks) ? props.task.subtasks : []
);
const hasSubtasks = computed(() => subtasks.value.length > 0);
const hasIncompleteSubtasks = computed(() => 
  subtasks.value.some((subtask) => !subtask.completed)
);
const isCheckboxDisabled = computed(() => props.isCompletedPage);
const showIncompleteSubtasksConfirm = ref(false);
const pendingToggleTask = ref(null);

const isDueToday = computed(() => {
  if (!dueDate.value) {
    return false;
  }

  const today = new Date();
  return (
    dueDate.value.getFullYear() === today.getFullYear()
    && dueDate.value.getMonth() === today.getMonth()
    && dueDate.value.getDate() === today.getDate()
  );
});

const showMoveToTomorrow = computed(() => !props.isCompletedPage && !isLongTerm.value && isDueToday.value);
const showMoveToToday = computed(() => !props.isCompletedPage && !isLongTerm.value && !isDueToday.value);
const showWorkedOnAction = computed(
  () => !props.isCompletedPage && !isLongTerm.value && props.showWorkedOnAction && Boolean(props.workedOnActionLabel)
);
const showLongTermWorkedOn = computed(
  () => !props.isCompletedPage && isLongTerm.value
);
const canSkipRecurrence = computed(
  () => !props.isCompletedPage
    && Boolean(props.task.recurrence)
    && !props.task.completed
);
const showEditAction = computed(() => !props.isCompletedPage);
const showAdjustCompletionDate = computed(() => props.isCompletedPage);

const closeMenu = () => {
  menuOpen.value = false;
};

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value;
};

const handleDocumentClick = (event) => {
  if (!menuOpen.value) {
    return;
  }

  const buttonEl = menuButton.value;
  const menuEl = menuPanel.value;
  const target = event.target;

  if (buttonEl && buttonEl.contains(target)) {
    return;
  }

  if (menuEl && menuEl.contains(target)) {
    return;
  }

  closeMenu();
};

onMounted(() => {
  window.addEventListener('click', handleDocumentClick);

  measureDescriptionOverflow();
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleDocumentClick);
});

const handleToggle = () => {
  // If task has incomplete subtasks and is not completed, show confirmation
  if (!props.task.completed && hasSubtasks.value && hasIncompleteSubtasks.value) {
    pendingToggleTask.value = props.task;
    showIncompleteSubtasksConfirm.value = true;
    return;
  }
  
  emit('toggle', props.task);
};

const handleConfirmIncompleteSubtasks = () => {
  showIncompleteSubtasksConfirm.value = false;
  if (pendingToggleTask.value) {
    emit('toggle', pendingToggleTask.value);
    pendingToggleTask.value = null;
  }
};

const handleCancelIncompleteSubtasks = () => {
  showIncompleteSubtasksConfirm.value = false;
  pendingToggleTask.value = null;
};

const incompleteSubtasksCount = computed(() => 
  subtasks.value.filter((subtask) => !subtask.completed).length
);

const handleRemove = () => {
  emit('remove', props.task);
  closeMenu();
};

const handleEdit = () => {
  if (props.task.completed) {
    closeMenu();
    return;
  }
  emit('edit', props.task);
  closeMenu();
};

const handleDuplicate = () => {
  emit('duplicate', props.task);
  closeMenu();
};

const handleMoveToToday = () => {
  emit('move-to-today', props.task);
  closeMenu();
};

const handleMoveToTomorrow = () => {
  emit('move-to-tomorrow', props.task);
  closeMenu();
};

const handleMoveToNextWeek = () => {
  emit('move-to-next-week', props.task);
  closeMenu();
};

const handleWorkedOn = () => {
  emit('worked-on', props.task);
  closeMenu();
};

const handleLongTermWorkedOn = () => {
  emit('long-term-worked-on', props.task);
  closeMenu();
};

const handleSkipRecurrence = () => {
  emit('skip-recurrence', props.task);
  closeMenu();
};

const handleAdjustCompletionDate = () => {
  emit('adjust-completion-date', props.task);
  closeMenu();
};

const handleEditCompletionNotes = () => {
  emit('edit-completion-notes', props.task);
  closeMenu();
};

const handleToggleSubtask = (subtask) => {
  emit('toggle-subtask', { taskId: props.task.id, subtaskId: subtask.id });
};

const completedDateObj = computed(() => {
  if (!props.completedDate) {
    return null;
  }

  const date = new Date(props.completedDate);
  return Number.isNaN(date.getTime()) ? null : date;
});

const formattedCompletedDate = computed(() => {
  if (!completedDateObj.value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: completedDateObj.value.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(completedDateObj.value);
});

const formattedCompletedTime = computed(() => {
  if (!completedDateObj.value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(completedDateObj.value);
});

const completedDateIso = computed(() => (completedDateObj.value ? completedDateObj.value.toISOString() : ''));

const formattedCompletedLabel = computed(() => {
  if (!formattedCompletedDate.value) {
    return '';
  }

  return `${formattedCompletedDate.value} at ${formattedCompletedTime.value}`;
});

const isWorkedOn = computed(() => Boolean(props.task?.workedOn));

const descriptionText = computed(() => (typeof props.task.description === 'string' ? props.task.description : ''));
const toggleDescription = () => {
  isDescriptionExpanded.value = !isDescriptionExpanded.value;
};

const measureDescriptionOverflow = async () => {
  await nextTick();
  const el = descriptionEl.value;
  if (!el) {
    canToggleDescription.value = false;
    return;
  }

  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight);
  if (!lineHeight) {
    canToggleDescription.value = false;
    return;
  }

  const totalLines = Math.round(el.scrollHeight / lineHeight);
  canToggleDescription.value = totalLines > 3;
};

watch(descriptionText, () => {
  isDescriptionExpanded.value = false;
  measureDescriptionOverflow();
});
</script>

<template>
  <article class="task">
    <header class="task__header">
      <div class="task__checkbox">
        <input
          type="checkbox"
          class="task__checkbox-input"
          :checked="task.completed"
          :aria-label="`Mark ${task.title} as ${task.completed ? 'pending' : 'completed'}`"
          :disabled="isCheckboxDisabled"
          @change.stop="handleToggle"
        />
        <span class="task__title">{{ task.title }}</span>
      </div>
      <div class="task__actions">
        <div class="task__menu" @keydown.esc.stop="closeMenu">
          <button
            ref="menuButton"
            type="button"
            class="task__menu-trigger"
            aria-haspopup="true"
            :aria-expanded="menuOpen"
            aria-label="Task options"
            @click.stop="toggleMenu"
          >
            <IconGlyph name="more-vertical" size="18" aria-hidden="true" />
          </button>
          <transition name="task-menu">
            <ul
              v-if="menuOpen"
              ref="menuPanel"
              class="task__menu-list"
              role="menu"
              @click.stop
            >
              <li v-if="showMoveToToday" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleMoveToToday"
                >
                  Move to Today
                </button>
              </li>
              <li v-if="showMoveToTomorrow" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleMoveToTomorrow"
                >
                  Move to Tomorrow
                </button>
              </li>
              <li v-if="showMoveToTomorrow" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleMoveToNextWeek"
                >
                  Move to Monday
                </button>
              </li>
              <li v-if="showWorkedOnAction" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleWorkedOn"
                >
                  {{ workedOnActionLabel }}
                </button>
              </li>
              <li v-if="showLongTermWorkedOn" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleLongTermWorkedOn"
                >
                  Mark as Worked on
                </button>
              </li>
              <li v-if="canSkipRecurrence" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleSkipRecurrence"
                >
                  Skip recurrence
                </button>
              </li>
              <li v-if="showAdjustCompletionDate" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleAdjustCompletionDate"
                >
                  Adjust Completion Date
                </button>
              </li>
              <li v-if="isCompletedPage" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleEditCompletionNotes"
                >
                  Change Completion Notes
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleDuplicate"
                >
                  Duplicate
                </button>
              </li>
              <li v-if="showEditAction" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  :disabled="task.completed"
                  @click="handleEdit"
                >
                  Edit
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  class="task__menu-item task__menu-item--danger"
                  role="menuitem"
                  @click="handleRemove"
                >
                  Delete
                </button>
              </li>
            </ul>
          </transition>
        </div>
      </div>
    </header>

    <div v-if="task.description" class="task__description-row">
      <p
        ref="descriptionEl"
        class="task__description"
        :class="{ 'task__description--clamped': !isDescriptionExpanded }"
      >
        {{ task.description }}
      </p>
      <button
        v-if="canToggleDescription"
        type="button"
        class="task__description-toggle"
        :aria-expanded="isDescriptionExpanded"
        @click="toggleDescription"
      >
        {{ isDescriptionExpanded ? 'Show Less' : 'Show More' }}
      </button>
    </div>

    <div v-if="subtasks.length" class="task__subtasks">
      <div v-for="subtask in subtasks" :key="subtask.id" class="task__subtask">
        <label class="task__subtask-label">
          <input
            type="checkbox"
            class="task__subtask-checkbox"
            :checked="subtask.completed"
            :disabled="props.isCompletedPage"
            :aria-label="`Mark subtask ${subtask.title} as ${subtask.completed ? 'pending' : 'completed'}`"
            @change.stop="handleToggleSubtask(subtask)"
          />
          <span
            :class="[
              'task__subtask-title',
              { 'task__subtask-title--completed': subtask.completed },
            ]"
          >
            {{ subtask.title }}
          </span>
        </label>
      </div>
    </div>

    <div v-if="isLongTerm" class="task__long-term">
      <span v-if="formattedStartDate" class="task__long-term-date">
        Start {{ formattedStartDate }}
      </span>
      <span v-if="formattedDeadline" class="task__long-term-date">
        • Deadline {{ formattedDeadline }}
      </span>
      <span
        v-if="daysRemainingLabel"
        class="task__days-remaining"
        :class="{
          'task__days-remaining--overdue': daysRemaining !== null && daysRemaining < 0,
          'task__days-remaining--today': daysRemaining === 0,
          'task__days-remaining--soon': daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3
        }"
      >
        ({{ daysRemainingLabel }})
      </span>
    </div>

    <time v-else-if="formattedDueLabel" class="task__due" :datetime="dueDateIso">Due {{ formattedDueLabel }}</time>

    <time v-if="formattedCompletedLabel" class="task__completed-date" :datetime="completedDateIso">Completed {{ formattedCompletedLabel }}</time>

    <span v-if="isCompletedPage && isWorkedOn" class="task__worked-on">Worked on</span>

    <div
      v-if="isCompletedPage && task.completionNotes"
      class="task__completion-notes"
    >
      <p class="task__completion-notes-label">Completion Notes</p>
      <p class="task__completion-notes-body">
        {{ task.completionNotes }}
      </p>
    </div>

    <footer class="task__meta">
      <span v-if="listLabel" class="task__list">
        {{ listLabel }}
      </span>
      <span v-if="priorityLabel" class="task__priority">
        {{ priorityLabel }}
      </span>
      <span v-if="recurrenceLabel" v-tooltip="recurrenceLabel" class="task__recurrence">
        <IconGlyph name="repeat" size="14" aria-hidden="true" />
      </span>
      <span v-if="reminderLabel" v-tooltip="`Reminder ${reminderLabel}`" class="task__reminder">
        <IconGlyph name="alert" size="14" aria-hidden="true" />
      </span>
    </footer>

    <ConfirmDialog
      v-model:open="showIncompleteSubtasksConfirm"
      title="Complete with incomplete subtasks?"
      :message="`This task has ${incompleteSubtasksCount} incomplete subtask${incompleteSubtasksCount === 1 ? '' : 's'}. Completing it will mark all subtasks as complete. Continue?`"
      confirm-label="Complete Task"
      cancel-label="Cancel"
      @confirm="handleConfirmIncompleteSubtasks"
      @cancel="handleCancelIncompleteSubtasks"
    />
  </article>
</template>

<style scoped lang="scss">
@use 'sass:color';
@use '../styles/theme' as theme;

$task-border: theme.$color-border-strong;
$task-bg: #141414;
$task-heading: theme.$color-text-heading;
$task-description: #c7d2fe;
$task-muted: #9ca3af;
$checkbox-accent: theme.$color-accent;
$checkbox-bg: theme.$color-surface-ghost-soft;
$task-due: #fb7185;
$task-completed: theme.$color-text-disabled;
$remove-hover: theme.$color-accent-hover;

.task {
  border: 1px solid $task-border;
  border-radius: 1rem;
  padding: 1.1rem 1.25rem;
  background: $task-bg;
  display: grid;
  gap: 0.85rem;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: theme.$color-accent-soft-border-medium;
    transform: translateY(-1px);
    box-shadow: theme.$shadow-accent-card-hover;
  }
}

.task__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  /* Ensure adequate touch target height on mobile */
  @media (max-width: 768px) {
    min-height: 44px;
  }
}

.task__checkbox {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-weight: 600;
  color: $task-heading;
}

.task__checkbox-input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: $checkbox-accent;
  background: $checkbox-bg;
  border: 1px solid $task-border;

  /* Larger checkbox on mobile for better touch */
  @media (max-width: 768px) {
    width: 1.375rem;
    height: 1.375rem;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    accent-color: $task-muted;
    border-color: $task-muted;
  }
}

.task__title {
  color: $task-heading;
}

.task__description {
  margin: 0;
  color: $task-description;
  line-height: 1.5;
  white-space: pre-line;
  flex: 1;
  min-width: 0;
}

.task__description--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task__description-toggle {
  align-self: flex-start;
  background: none;
  border: none;
  color: $checkbox-accent;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
  margin-top: 0.8rem;

  &:hover {
    color: color.adjust($checkbox-accent, $lightness: 5%);
  }

  &:focus-visible {
    outline: 2px solid $checkbox-accent;
    outline-offset: 2px;
  }
}

.task__subtasks {
  display: grid;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid $task-border;
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.03);
}

.task__subtask {
  display: flex;
  align-items: center;
}

.task__subtask-label {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  color: $task-heading;
  font-weight: 600;
}

.task__subtask-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: $checkbox-accent;
  flex: none;
}

.task__subtask-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.task__subtask-title--completed {
  text-decoration: line-through;
  color: $task-muted;
}

.task__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: $task-muted;
}

.task__list {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(148, 163, 184, 0.12);
  color: $task-heading;
  font-weight: 600;
  font-size: 0.8rem;
  max-width: 100%;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.task__priority {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(251, 191, 36, 0.28);
  background: rgba(251, 191, 36, 0.14);
  color: #fde68a;
  font-weight: 600;
  font-size: 0.8rem;
  max-width: 100%;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.task__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task__menu {
  position: relative;
}

.task__menu-trigger {
  border: 1px solid $task-border;
  background: rgba(255, 255, 255, 0.04);
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  font-size: 1rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  padding: 0;

  /* Minimum 44px touch target on mobile */
  @media (max-width: 768px) {
    width: 2.75rem;
    height: 2.75rem;
  }

  &:hover {
    color: $task-heading;
    border-color: $checkbox-accent;
    background: theme.$color-surface-ghost-strong;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid $checkbox-accent;
    outline-offset: 2px;
  }

  .icon-glyph {
    flex: none;
    width: 1rem;
    height: 1rem;
    display: block;
  }
}

.task__menu-list {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  min-width: 8rem;
  margin: 0;
  padding: 0.35rem 0;
  list-style: none;
  background: #1c1c1d;
  border: 1px solid $task-border;
  border-radius: 0.65rem;
  box-shadow: 0 16px 32px -24px rgba(0, 0, 0, 0.75);
  display: grid;
  gap: 0.25rem;
  z-index: 5;
}

.task__menu-item {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: $task-heading;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  display: block;
  transition: background 0.2s ease, color 0.2s ease;

  /* Larger touch target on mobile */
  @media (max-width: 768px) {
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
  }

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: $checkbox-accent;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.task__menu-item--danger {
  color: $remove-hover;

  &:hover:not(:disabled) {
    background: theme.$color-accent-soft;
    color: $remove-hover;
  }
}

.task__recurrence {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  background: theme.$color-success-soft-strong;
  color: theme.$color-success-bright;
  cursor: help;
  transition: background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: theme.$color-success-soft-hover;
    transform: scale(1.05);
  }
}

.task__reminder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.16);
  color: #bfdbfe;
  cursor: help;
  transition: background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: rgba(59, 130, 246, 0.24);
    transform: scale(1.05);
  }
}

.task__due {
  color: $task-due;
}

.task__long-term {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  color: $task-due;
}

.task__long-term-date {
  color: $task-due;
}

.task__days-remaining {
  color: $task-muted;
  font-size: 0.9rem;
}

.task__days-remaining--overdue {
  color: $task-due;
  font-weight: 600;
}

.task__days-remaining--today {
  color: #facc15;
  font-weight: 600;
}

.task__days-remaining--soon {
  color: #fb923c;
  font-weight: 600;
}

.task__completed-date {
  color: $task-muted;
  font-size: 0.9rem;
}

.task__completion-notes {
  padding: 0.75rem 0.85rem;
  border: 1px dashed $task-border;
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  gap: 0.35rem;
}

.task__completion-notes-label {
  margin: 0;
  font-weight: 700;
  color: $task-heading;
  font-size: 0.9rem;
}

.task__completion-notes-body {
  margin: 0;
  color: $task-description;
  white-space: pre-line;
  line-height: 1.5;
}

.task__worked-on {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.18);
  border: 1px solid rgba(96, 165, 250, 0.5);
  color: #bfdbfe;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.task-menu-enter-active,
.task-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.task-menu-enter-from,
.task-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
