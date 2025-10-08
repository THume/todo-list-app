<script setup>
import { computed } from 'vue';

const emit = defineEmits(['toggle', 'remove']);

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

const dueDateIso = computed(() => (dueDate.value ? dueDate.value.toISOString() : ''));

const statusLabel = computed(() => (props.task.completed ? 'Completed' : 'Pending'));

const formattedDueLabel = computed(() => {
  if (!formattedDueDate.value) {
    return '';
  }

  if (!formattedDueTime.value) {
    return formattedDueDate.value;
  }

  return `${formattedDueDate.value} at ${formattedDueTime.value}`;
});

const handleToggle = () => {
  emit('toggle', props.task);
};

const handleRemove = () => {
  emit('remove', props.task);
};
</script>

<template>
  <article class="task" :class="{ 'task--completed': task.completed }">
    <header class="task__header">
      <label class="task__checkbox">
        <input
          type="checkbox"
          class="task__checkbox-input"
          :checked="task.completed"
          @change="handleToggle"
        />
        <span class="task__title">{{ task.title }}</span>
      </label>
      <button
        type="button"
        class="task__remove"
        aria-label="Remove task"
        @click="handleRemove"
      >
        x
      </button>
    </header>

    <p v-if="task.description" class="task__description">
      {{ task.description }}
    </p>

    <footer class="task__meta">
      <span class="task__status">{{ statusLabel }}</span>
      <time v-if="formattedDueLabel" class="task__due" :datetime="dueDateIso">
        Due {{ formattedDueLabel }}
      </time>
    </footer>
  </article>
</template>

<style scoped lang="scss">
$task-border: #262626;
$task-bg: #141414;
$task-text: #f4f4f5;
$task-heading: #f8fafc;
$task-muted: #a1a1aa;
$task-description: #d4d4d8;
$task-completed: #71717a;
$task-due: #ef4444;
$remove-hover: #ef4444;
$checkbox-accent: #ef4444;
$checkbox-bg: #101010;

.task {
  display: grid;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border: 1px solid $task-border;
  border-radius: 0.75rem;
  background: $task-bg;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  color: $task-text;

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__checkbox {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    font-weight: 600;
    color: $task-heading;
  }

  &__checkbox-input {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: $checkbox-accent;
    background: $checkbox-bg;
    border: 1px solid $task-border;
  }

  &__title {
    color: $task-heading;
  }

  &__description {
    margin: 0;
    color: $task-description;
    line-height: 1.5;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.85rem;
    color: $task-muted;
  }

  &__status {
    font-weight: 600;
    color: $task-heading;
  }

  &__due {
    color: $task-due;
  }

  &__remove {
    border: none;
    background: transparent;
    color: $task-muted;
    font-size: 1.35rem;
    line-height: 1;
    padding: 0;
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover {
      color: $remove-hover;
    }
  }

  &--completed {
    .task__title {
      color: $task-completed;
      text-decoration: line-through;
    }
  }
}
</style>
