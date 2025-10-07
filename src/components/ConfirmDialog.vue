<script setup>
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Confirm action',
  },
  confirmLabel: {
    type: String,
    default: 'Confirm',
  },
  cancelLabel: {
    type: String,
    default: 'Cancel',
  },
  itemLabel: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:open', 'confirm', 'cancel']);

const panel = ref(null);
const uniqueId = Math.random().toString(36).slice(2);
const titleId = `confirm-dialog-title-${uniqueId}`;
const descriptionId = `confirm-dialog-description-${uniqueId}`;

const resolvedMessage = computed(() => {
  if (props.message.trim().length > 0) {
    return props.message;
  }

  const label = props.itemLabel.trim().length > 0 ? `"${props.itemLabel.trim()}"` : 'this item';
  return `This will permanently remove ${label} from your list.`;
});

const close = () => {
  emit('update:open', false);
};

const handleCancel = () => {
  close();
  emit('cancel');
};

const handleConfirm = () => {
  close();
  emit('confirm');
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => panel.value?.focus());
    }
  }
);
</script>

<template>
  <transition name="dialog-fade">
    <div
      v-if="open"
      class="confirm-dialog"
      role="presentation"
      @click.self="handleCancel"
    >
      <div
        ref="panel"
        class="confirm-dialog__panel"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="descriptionId"
        tabindex="-1"
        @keydown.esc.prevent="handleCancel"
      >
        <h2 :id="titleId" class="confirm-dialog__title">
          {{ title }}
        </h2>
        <div :id="descriptionId" class="confirm-dialog__body">
          <slot>
            <p class="confirm-dialog__message">
              {{ resolvedMessage }}
            </p>
          </slot>
        </div>
        <div class="confirm-dialog__actions">
          <button
            type="button"
            class="confirm-dialog__button confirm-dialog__button--cancel"
            @click="handleCancel"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="confirm-dialog__button confirm-dialog__button--danger"
            @click="handleConfirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
$dialog-backdrop: rgba(2, 6, 23, 0.75);
$dialog-panel-bg: #0f172a;
$dialog-border: #273449;
$input-text: #f8fafc;
$muted-text: #94a3b8;
$focus-outline: #22d3ee;
$danger-bg: #f87171;
$danger-bg-hover: #ef4444;
$danger-text: #0f172a;

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.confirm-dialog {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: $dialog-backdrop;
  z-index: 1000;
  padding: 1.5rem;
  box-sizing: border-box;

  &__panel {
    width: min(100%, 24rem);
    background: $dialog-panel-bg;
    border-radius: 1rem;
    border: 1px solid $dialog-border;
    padding: 1.75rem;
    box-shadow: 0 24px 40px -24px rgba(14, 23, 42, 0.6);
    display: grid;
    gap: 1.25rem;
    outline: none;
  }

  &__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: $input-text;
  }

  &__body {
    margin: 0;
  }

  &__message {
    margin: 0;
    color: $muted-text;
    line-height: 1.6;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  &__button {
    border: none;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 0.95rem;
    padding: 0.65rem 1.25rem;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

    &:focus-visible {
      outline: 2px solid $focus-outline;
      outline-offset: 2px;
    }

    &:hover {
      transform: translateY(-1px);
    }

    &--cancel {
      background: transparent;
      color: $input-text;
      border: 1px solid $dialog-border;

      &:hover {
        background: rgba(15, 27, 42, 0.6);
      }
    }

    &--danger {
      background: $danger-bg;
      color: $danger-text;
      box-shadow: 0 12px 24px -16px rgba(248, 113, 113, 0.8);

      &:hover {
        background: $danger-bg-hover;
        box-shadow: 0 16px 28px -18px rgba(248, 113, 113, 0.9);
      }
    }
  }
}
</style>
