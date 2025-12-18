<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  taskTitle: {
    type: String,
    default: '',
  },
  currentCompletedAt: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['update:visible', 'save', 'cancel']);

const completedDate = ref('');
const completedTime = ref('');
const error = ref('');

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

const maxDate = computed(() => toDateInputValue(new Date()));

const handleCancel = () => {
  emit('update:visible', false);
  emit('cancel');
};

const handleSubmit = () => {
  if (!completedDate.value) {
    error.value = 'Select a date to continue.';
    return;
  }

  const iso = buildIsoFromInputs(completedDate.value, completedTime.value);
  if (!iso) {
    error.value = 'Enter a valid date and time.';
    return;
  }

  emit('save', iso);
  emit('update:visible', false);
};

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      completedDate.value = toDateInputValue(props.currentCompletedAt);
      completedTime.value = toTimeInputValue(props.currentCompletedAt);
      error.value = '';
    }
  },
  { immediate: true }
);
</script>

<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-backdrop" @click.self="handleCancel">
      <div
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header class="modal-header">
          <h2 id="modal-title" class="modal-title">Adjust Completion Date</h2>
        </header>
        <form class="modal-body" @submit.prevent="handleSubmit">
          <p v-if="taskTitle" class="modal-task-title">{{ taskTitle }}</p>
          <div class="modal-fields">
            <label class="modal-field">
              <span class="modal-field-label">Date</span>
              <input
                v-model="completedDate"
                type="date"
                name="completedDate"
                :max="maxDate"
                aria-label="Completed date"
                required
                class="modal-input"
              />
            </label>
            <label class="modal-field">
              <span class="modal-field-label">Time</span>
              <input
                v-model="completedTime"
                type="time"
                name="completedTime"
                aria-label="Completed time"
                class="modal-input"
              />
            </label>
          </div>
          <p v-if="error" class="modal-error">
            {{ error }}
          </p>
          <div class="modal-actions">
            <button type="submit" class="modal-button modal-button--primary">
              Save
            </button>
            <button
              type="button"
              class="modal-button"
              @click="handleCancel"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal-panel {
  background: #1a1a1b;
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  max-width: 28rem;
  width: 100%;
  box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.85);
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid theme.$color-border-input;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.modal-body {
  padding: 1.5rem;
  display: grid;
  gap: 1rem;
}

.modal-task-title {
  margin: 0;
  color: theme.$color-text-primary;
  font-weight: 600;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 0.5rem;
  border: 1px solid theme.$color-border-input;
}

.modal-fields {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.modal-field {
  display: grid;
  gap: 0.5rem;
}

.modal-field-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: theme.$color-text-muted;
}

.modal-input {
  width: 100%;
  border: 1px solid theme.$color-border-input;
  background: rgba(12, 12, 13, 0.6);
  color: theme.$color-text-primary;
  padding: 0.65rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  transition: border-color 0.2s ease, background 0.2s ease;

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
    border-color: theme.$color-accent;
    background: rgba(12, 12, 13, 0.85);
  }
}

.modal-error {
  margin: 0;
  color: rgba(248, 113, 113, 0.95);
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 0.5rem;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
}

.modal-button {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.65rem 1.25rem;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;

  &:hover {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(34, 197, 94, 0.15);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.modal-button--primary {
  background: theme.$color-accent;
  border-color: theme.$color-accent;
  color: theme.$color-text-inverted;

  &:hover {
    background: theme.$color-accent-hover;
    border-color: theme.$color-accent-hover;
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;

  .modal-panel {
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal-panel {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
}
</style>
