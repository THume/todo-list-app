<script setup>
import { computed, ref, watch } from 'vue';
import ModalBase from './ModalBase.vue';

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
  <ModalBase
    :open="visible"
    title="Adjust Completion Date"
    :subtitle="taskTitle"
    size="medium"
    @update:open="$emit('update:visible', $event)"
    @close="handleCancel"
  >
    <template #default>
      <form class="modal-form" @submit.prevent="handleSubmit">
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
        </div>
      </form>
    </template>
  </ModalBase>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.modal-form {
  display: grid;
  gap: 1rem;
}

.modal-fields {
  @include theme.modal-fields;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.modal-field {
  display: grid;
  gap: 0.5rem;
}

.modal-field-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: theme.$color-text-muted;
}

.modal-input {
  @include theme.modal-form-input;
  width: 100%;
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
  @include theme.modal-actions;
}

.modal-button {
  @include theme.modal-action-button;
}
</style>
