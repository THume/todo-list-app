<script setup>
import { computed, ref, watch } from 'vue';
import ModalBase from './ModalBase.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  goal: {
    type: Object,
    default: null,
  },
  outcome: {
    type: String,
    default: 'succeeded',
  },
});

const emit = defineEmits(['update:visible', 'confirm', 'cancel']);

const notes = ref('');
const actualCount = ref('0');

const isCountGoal = computed(() => props.goal?.trackingType === 'count');
const title = computed(() => {
  if (props.outcome === 'failed') {
    return 'Mark Goal as Failed';
  }
  return 'Mark Goal as Succeeded';
});

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) {
      return;
    }
    notes.value = '';
    actualCount.value = String(props.goal?.currentCount ?? 0);
  }
);

const closeModal = () => {
  emit('update:visible', false);
  emit('cancel');
};

const parseCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(0, Math.floor(numeric));
};

const handleConfirm = () => {
  emit('confirm', {
    outcome: props.outcome,
    notes: typeof notes.value === 'string' ? notes.value.trim() : '',
    actualCount: isCountGoal.value ? parseCount(actualCount.value) : null,
  });
  emit('update:visible', false);
};
</script>

<template>
  <ModalBase
    :open="visible"
    :title="title"
    size="medium"
    @update:open="$emit('update:visible', $event)"
    @close="closeModal"
  >
    <div class="goal-outcome">
      <p class="goal-outcome__hint">
        {{ goal?.title || 'Goal' }}
      </p>

      <label v-if="isCountGoal" class="goal-outcome__field">
        <span class="goal-outcome__label">Actual count</span>
        <input
          v-model="actualCount"
          class="goal-outcome__input"
          type="number"
          min="0"
          step="1"
        >
      </label>

      <label class="goal-outcome__field">
        <span class="goal-outcome__label">Notes (optional)</span>
        <textarea
          v-model="notes"
          class="goal-outcome__textarea"
          rows="4"
          maxlength="500"
        />
      </label>
    </div>

    <template #actions>
      <div class="goal-outcome__actions">
        <button type="button" class="goal-outcome__button goal-outcome__button--cancel" @click="closeModal">
          Cancel
        </button>
        <button
          type="button"
          :class="[
            'goal-outcome__button',
            outcome === 'failed' ? 'goal-outcome__button--danger' : 'goal-outcome__button--primary'
          ]"
          @click="handleConfirm"
        >
          Confirm
        </button>
      </div>
    </template>
  </ModalBase>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.goal-outcome {
  display: grid;
  gap: 1rem;
}

.goal-outcome__hint {
  margin: 0;
  color: theme.$color-text-primary;
  font-weight: 600;
}

.goal-outcome__field {
  display: grid;
  gap: 0.45rem;
}

.goal-outcome__label {
  color: theme.$color-text-muted;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.goal-outcome__input,
.goal-outcome__textarea {
  @include theme.modal-form-input;
}

.goal-outcome__textarea {
  resize: vertical;
}

.goal-outcome__actions {
  @include theme.modal-actions;
}

.goal-outcome__button {
  @include theme.modal-action-button;
}
</style>
