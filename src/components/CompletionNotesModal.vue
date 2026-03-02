<script setup>
import { ref, watch } from 'vue';

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
  <Transition name="modal">
    <div v-if="visible" class="modal-backdrop" @click.self="handleCancel">
      <div
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-notes-title"
      >
        <header class="modal-header">
          <h2 id="completion-notes-title" class="modal-title">Completion Notes</h2>
          <p v-if="taskTitle" class="modal-subtitle">{{ taskTitle }}</p>
        </header>
        <form class="modal-body" @submit.prevent="handleSave">
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

@media (max-width: 768px) {
  .modal-backdrop {
    align-items: flex-start;
    padding-top: 72px;
  }
}

.modal-panel {
  background: #1a1a1b;
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  max-width: 30rem;
  width: 100%;
  box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.85);
}

.modal-header {
  padding: 1.25rem 1.5rem 0.5rem;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.modal-subtitle {
  margin: 0.35rem 0 0;
  color: theme.$color-text-muted;
}

.modal-body {
  padding: 0.5rem 1.5rem 1.25rem;
  display: grid;
  gap: 1rem;
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
  width: 100%;
  border: 1px solid theme.$color-border-input;
  background: rgba(12, 12, 13, 0.6);
  color: theme.$color-text-primary;
  padding: 0.75rem 0.85rem;
  border-radius: 0.85rem;
  font-size: 1rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 8rem;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.modal-textarea:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
  border-color: theme.$color-accent;
  background: rgba(12, 12, 13, 0.85);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.modal-button {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  font-weight: 700;
  padding: 0.55rem 1.2rem;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.08);
    border-color: theme.$color-accent;
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.modal-button--primary {
  background: theme.$color-accent;
  color: theme.$color-text-inverted;
  border-color: theme.$color-accent;
  box-shadow: 0 12px 24px -18px rgba(239, 68, 68, 0.8);

  &:hover {
    background: theme.$color-accent-hover;
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
