<script setup>
import { ref, watch } from 'vue';
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
  initialNotes: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:visible', 'save', 'cancel']);

const notes = ref('');

const handleCancel = () => {
  emit('update:visible', false);
  emit('cancel');
};

const handleSave = () => {
  emit('save', notes.value);
  emit('update:visible', false);
};

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      notes.value = props.initialNotes ?? '';
    }
  },
  { immediate: true }
);
</script>

<template>
  <ModalBase
    :open="visible"
    title="Completion Notes"
    :subtitle="taskTitle"
    size="large"
    @update:open="$emit('update:visible', $event)"
    @close="handleCancel"
  >
    <template #default>
      <form class="modal-form" @submit.prevent="handleSave">
        <label class="modal-field">
          <span class="modal-field-label">Notes</span>
          <textarea
            v-model="notes"
            class="modal-textarea"
            name="completion-notes"
            rows="6"
            aria-label="Completion notes"
            placeholder="Add details about how this task was completed"
          ></textarea>
        </label>
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
  @include theme.modal-fields;
}

.modal-field {
  display: grid;
  gap: 0.35rem;
}

.modal-field-label {
  color: theme.$color-text-muted;
  font-weight: 700;
}

.modal-textarea {
  @include theme.modal-form-input;
  width: 100%;
  border-radius: 0.85rem;
  font-size: 1rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 8rem;
}

.modal-actions {
  @include theme.modal-actions;
}

.modal-button {
  @include theme.modal-action-button;
}
</style>
