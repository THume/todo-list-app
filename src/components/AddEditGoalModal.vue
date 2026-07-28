<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import ModalBase from './ModalBase.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'add',
    validator: (value) => ['add', 'edit'].includes(value),
  },
  goal: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:visible', 'submit', 'save', 'cancel']);

const title = ref('');
const description = ref('');
const trackingType = ref('binary');
const period = ref('none');
const startDate = ref('');
const targetDate = ref('');
const targetCount = ref('1');
const currentCount = ref('0');
const showCountValidation = ref(false);

const periodOptions = [
  { value: 'none', label: 'No period' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const isEditMode = computed(() => props.mode === 'edit');
const isCountGoal = computed(() => trackingType.value === 'count');
const canSubmit = computed(() => title.value.trim().length > 0);

const parseCountInput = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.floor(numeric));
};

const resetForm = () => {
  const goal = props.goal;
  if (!goal) {
    title.value = '';
    description.value = '';
    trackingType.value = 'binary';
    period.value = 'none';
    startDate.value = '';
    targetDate.value = '';
    targetCount.value = '1';
    currentCount.value = '0';
    showCountValidation.value = false;
    return;
  }

  title.value = goal.title ?? '';
  description.value = goal.description ?? '';
  trackingType.value = goal.trackingType === 'count' ? 'count' : 'binary';
  period.value = goal.period ?? 'none';
  startDate.value = goal.startDate ?? '';
  targetDate.value = goal.targetDate ?? '';
  targetCount.value = String(goal.targetCount ?? 1);
  currentCount.value = String(goal.currentCount ?? 0);
  showCountValidation.value = false;
};

const closeModal = () => {
  emit('update:visible', false);
  emit('cancel');
};

const handleSubmit = () => {
  const trimmedTitle = title.value.trim();
  if (!trimmedTitle) {
    return;
  }

  const parsedTarget = parseCountInput(targetCount.value, 1);
  if (isCountGoal.value && parsedTarget < 1) {
    showCountValidation.value = true;
    return;
  }

  showCountValidation.value = false;

  const payload = {
    title: trimmedTitle,
    description: description.value.trim(),
    trackingType: trackingType.value,
    period: period.value,
    startDate: startDate.value || null,
    targetDate: targetDate.value || null,
    targetCount: isCountGoal.value ? parsedTarget : null,
    currentCount: isCountGoal.value ? parseCountInput(currentCount.value, 0) : null,
  };

  if (isEditMode.value && props.goal?.id) {
    emit('save', { ...payload, id: props.goal.id });
  } else {
    emit('submit', payload);
  }

  emit('update:visible', false);
};

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) {
      return;
    }
    resetForm();
    nextTick(() => {
      const input = document.querySelector('[data-goal-title-input]');
      input?.focus();
    });
  }
);

watch(isCountGoal, (enabled) => {
  if (!enabled) {
    showCountValidation.value = false;
  }
});
</script>

<template>
  <ModalBase
    :open="visible"
    :title="isEditMode ? 'Edit Goal' : 'Add Goal'"
    size="large"
    @update:open="$emit('update:visible', $event)"
    @close="closeModal"
  >
    <form class="goal-form" @submit.prevent="handleSubmit">
      <label class="goal-form__field">
        <span class="goal-form__label">Title</span>
        <input
          v-model="title"
          data-goal-title-input
          type="text"
          class="goal-form__input"
          maxlength="160"
          required
        >
      </label>

      <label class="goal-form__field">
        <span class="goal-form__label">Description</span>
        <textarea
          v-model="description"
          class="goal-form__textarea"
          rows="3"
          maxlength="500"
        />
      </label>

      <div class="goal-form__grid">
        <label class="goal-form__field">
          <span class="goal-form__label">Tracking</span>
          <select v-model="trackingType" class="goal-form__input">
            <option value="binary">Binary (Succeeded/Failed)</option>
            <option value="count">Count-based</option>
          </select>
        </label>

        <label class="goal-form__field">
          <span class="goal-form__label">Period</span>
          <select v-model="period" class="goal-form__input">
            <option
              v-for="option in periodOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="goal-form__grid">
        <label class="goal-form__field">
          <span class="goal-form__label">Start date</span>
          <input v-model="startDate" type="date" class="goal-form__input">
        </label>

        <label class="goal-form__field">
          <span class="goal-form__label">Target date</span>
          <input v-model="targetDate" type="date" class="goal-form__input">
        </label>
      </div>

      <div v-if="isCountGoal" class="goal-form__grid">
        <label class="goal-form__field">
          <span class="goal-form__label">Target count</span>
          <input
            v-model="targetCount"
            type="number"
            min="1"
            step="1"
            class="goal-form__input"
          >
        </label>

        <label class="goal-form__field">
          <span class="goal-form__label">Current count</span>
          <input
            v-model="currentCount"
            type="number"
            min="0"
            step="1"
            class="goal-form__input"
          >
        </label>
      </div>

      <p v-if="showCountValidation" class="goal-form__error">
        Count-based goals require a target count of at least 1.
      </p>
    </form>

    <template #actions>
      <div class="goal-form__actions">
        <button type="button" class="goal-form__button goal-form__button--cancel" @click="closeModal">
          Cancel
        </button>
        <button
          type="button"
          class="goal-form__button goal-form__button--primary"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ isEditMode ? 'Save changes' : 'Create goal' }}
        </button>
      </div>
    </template>
  </ModalBase>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.goal-form {
  display: grid;
  gap: 1rem;
}

.goal-form__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
}

.goal-form__field {
  display: grid;
  gap: 0.45rem;
}

.goal-form__label {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: theme.$color-text-muted;
  text-transform: uppercase;
}

.goal-form__input,
.goal-form__textarea {
  width: 100%;
  box-sizing: border-box;

  @include theme.modal-form-input;
}

.goal-form__textarea {
  resize: vertical;
  min-height: 5rem;
}

.goal-form__error {
  margin: 0;
  color: theme.$color-accent-hover;
  font-size: 0.85rem;
}

.goal-form__actions {
  @include theme.modal-actions;
}

.goal-form__button {
  @include theme.modal-action-button;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }
}
</style>
