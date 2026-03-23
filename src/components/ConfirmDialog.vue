<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import ModalBase from './ModalBase.vue';

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

const resolvedMessage = computed(() => {
  if (props.message.trim().length > 0) {
    return props.message;
  }

  const label = props.itemLabel.trim().length > 0 ? `"${props.itemLabel.trim()}"` : 'this item';
  return `This will permanently remove ${label} from your list.`;
});

const handleCancel = () => {
  emit('update:open', false);
  emit('cancel');
};

const handleConfirm = () => {
  emit('update:open', false);
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
  <ModalBase
    :open="open"
    :title="title"
    role="alertdialog"
    size="small"
    @update:open="$emit('update:open', $event)"
    @close="handleCancel"
  >
    <template #default>
      <slot>
        <p class="confirm-dialog__message">
          {{ resolvedMessage }}
        </p>
      </slot>
    </template>
    <template #actions>
      <div class="confirm-dialog__actions">
        <button
          type="button"
          class="confirm-dialog__button confirm-dialog__button--danger"
          @click="handleConfirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </template>
  </ModalBase>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.confirm-dialog__message {
  margin: 0;
  color: theme.$color-text-muted;
  line-height: 1.6;
}

.confirm-dialog__actions {
  @include theme.modal-actions;
}

.confirm-dialog__button {
  @include theme.modal-action-button;
}
</style>
