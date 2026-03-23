<script setup>
import { onMounted, ref } from 'vue';
import IconGlyph from './IconGlyph.vue';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
  eyebrow: {
    type: String,
    default: '',
  },
  showCloseButton: {
    type: Boolean,
    default: true,
  },
  closeButtonLabel: {
    type: String,
    default: 'Close dialog',
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value),
  },
  role: {
    type: String,
    default: 'dialog',
    validator: (value) => ['dialog', 'alertdialog'].includes(value),
  },
  panelRef: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:open', 'close']);

const internalPanelRef = ref(null);
const uniqueId = Math.random().toString(36).slice(2);
const titleId = `modal-title-${uniqueId}`;
const descriptionId = `modal-description-${uniqueId}`;

const handleBackdropClick = () => {
  handleClose();
};

const handleEscape = () => {
  handleClose();
};

const handleClose = () => {
  emit('update:open', false);
  emit('close');
};

const handleCloseButtonClick = () => {
  handleClose();
};

onMounted(() => {
  if (props.panelRef?.value) {
    internalPanelRef.value = props.panelRef.value;
  }
});

const panelToFocus = () => props.panelRef?.value || internalPanelRef.value;

defineExpose({
  panelRef: panelToFocus,
  titleId,
  descriptionId,
});
</script>

<template>
  <Transition name="dialog-fade">
    <div
      v-if="open"
      class="modal-base-backdrop"
      role="presentation"
      @click.self="handleBackdropClick"
    >
      <div
        ref="internalPanelRef"
        :class="[
          'modal-base',
          `modal-base--${size}`,
        ]"
        :role="role"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="descriptionId"
        tabindex="-1"
        @keydown.esc.prevent="handleEscape"
      >
        <!-- Header slot or default header -->
        <slot name="header">
          <header class="modal-base__header">
            <div class="modal-base__header-content">
              <p v-if="eyebrow" class="modal-base__eyebrow">{{ eyebrow }}</p>
              <div class="modal-base__title-row">
                <h2 :id="titleId" class="modal-base__title">{{ title }}</h2>
              </div>
              <p v-if="subtitle" class="modal-base__subtitle">{{ subtitle }}</p>
            </div>
            <button
              v-if="showCloseButton"
              type="button"
              class="modal-base__close"
              :aria-label="closeButtonLabel"
              @click="handleCloseButtonClick"
            >
              <IconGlyph name="close" size="18" aria-hidden="true" />
            </button>
          </header>
        </slot>

        <!-- Body slot -->
        <div :id="descriptionId" class="modal-base__body">
          <slot><!-- Default empty body --></slot>
        </div>

        <!-- Actions slot (for buttons, etc.) -->
        <slot name="actions" />
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.modal-base-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 9, 12, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
  box-sizing: border-box;
  cursor: pointer;

  @media (max-width: 768px) {
    align-items: flex-start;
    padding-top: 72px;
  }
}

.modal-base {
  background: theme.$color-surface-elevated;
  border-radius: 1rem;
  border: 1px solid theme.$color-border-strong;
  box-shadow: 0 24px 40px -28px rgba(0, 0, 0, 0.7);
  display: grid;
  grid-template-columns: 1fr;
  grid-auto-rows: auto;
  gap: 0;
  outline: none;
  overflow: hidden;
  padding: 1.25rem;

  &--small {
    width: min(100%, 24rem);
  }

  &--medium {
    width: min(100%, 28rem);
  }

  &--large {
      width: min(640px, 100%);
  }
}

.modal-base__header {
  padding: 1rem;
  border-bottom: 1px solid theme.$color-border-input;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.modal-base__header-content {
  flex: 1;
  min-width: 0;
}

.modal-base__eyebrow {
  margin: 0 0 0.25rem 0;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: theme.$color-text-muted;
}

.modal-base__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-base__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: theme.$color-text-primary;
  word-break: break-word;
}

.modal-base__subtitle {
  margin: 0.5rem 0 0 0;
  font-size: 0.875rem;
  color: theme.$color-text-muted;
}

.modal-base__close {
  border: 1px solid theme.$color-border-muted;
  background: transparent;
  color: theme.$color-text-muted;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  flex-shrink: 0;
  padding: 0;

  &:hover {
    border-color: theme.$color-accent;
    color: theme.$color-text-heading;
    background: theme.$color-surface-ghost-soft;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.modal-base__body {
  padding: 1.75rem;
  grid-column: 1;
  display: grid;
  gap: 1rem;
  grid-auto-rows: auto;
}

/* Slot spacing adjustments */
:deep(.modal-base__actions) {
  padding: 1.75rem;
  border-top: 1px solid theme.$color-border-strong;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  grid-column: 1;
}
</style>
