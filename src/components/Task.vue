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

const emit = defineEmits([
  'toggle',
  'remove',
  'edit',
  'duplicate',
  'move-to-today',
  'move-to-tomorrow',
  'skip-recurrence',
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
  showSkipRecurrenceAction: {
    type: Boolean,
    default: false,
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
  switch (props.task.recurrence) {
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

const showMoveToTomorrow = computed(() => isDueToday.value);
const showMoveToToday = computed(() => !isDueToday.value);
const canSkipRecurrence = computed(
  () => props.showSkipRecurrenceAction && Boolean(props.task.recurrence) && !props.task.completed
);

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
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleDocumentClick);
  }

  measureDescriptionOverflow();
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleDocumentClick);
  }
});

const handleToggle = () => {
  emit('toggle', props.task);
};

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

const handleSkipRecurrence = () => {
  emit('skip-recurrence', props.task);
  closeMenu();
};

const descriptionText = computed(() => (typeof props.task.description === 'string' ? props.task.description : ''));
const toggleDescription = () => {
  isDescriptionExpanded.value = !isDescriptionExpanded.value;
};

const measureDescriptionOverflow = async () => {
  if (typeof window === 'undefined') {
    canToggleDescription.value = false;
    return;
  }

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
  <article class="task" :class="{ 'task--completed': task.completed }">
    <header class="task__header">
      <div class="task__checkbox">
        <input
          type="checkbox"
          class="task__checkbox-input"
          :checked="task.completed"
          :aria-label="`Mark ${task.title} as ${task.completed ? 'pending' : 'completed'}`"
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
              <li v-if="canSkipRecurrence" role="none">
                <button
                  type="button"
                  class="task__menu-item"
                  role="menuitem"
                  @click="handleSkipRecurrence"
                >
                  Skip Recurrence
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
              <li role="none">
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
        class="task__description"
        :class="{ 'task__description--clamped': !isDescriptionExpanded }"
        ref="descriptionEl"
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

    <footer class="task__meta">
      <span v-if="listLabel" class="task__list">
        {{ listLabel }}
      </span>
      <span v-if="recurrenceLabel" class="task__recurrence">{{ recurrenceLabel }}</span>
      <span v-if="reminderLabel" class="task__reminder">Reminder {{ reminderLabel }}</span>
      <time v-if="formattedDueLabel" class="task__due" :datetime="dueDateIso">Due {{ formattedDueLabel }}</time>
    </footer>
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
    border-color: rgba(239, 68, 68, 0.6);
    transform: translateY(-1px);
    box-shadow: 0 18px 32px -28px rgba(239, 68, 68, 0.65);
  }
}

.task__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
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
  color: $task-muted;
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

  &:hover {
    color: $task-heading;
    border-color: $checkbox-accent;
    background: rgba(255, 255, 255, 0.08);
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
    background: rgba(239, 68, 68, 0.12);
    color: $remove-hover;
  }
}

.task__recurrence {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.16);
  color: #4ade80;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.task__reminder {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.7rem;
  border-radius: 0.75rem;
  background: rgba(59, 130, 246, 0.16);
  color: #bfdbfe;
  font-weight: 600;
  font-size: 0.8rem;
}

.task__due {
  color: $task-due;
}

.task--completed {
  .task__title {
    color: $task-completed;
    text-decoration: line-through;
  }
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
