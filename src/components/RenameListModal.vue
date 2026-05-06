<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import ModalBase from './ModalBase.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  currentName: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:visible', 'submit', 'cancel']);

const nameInput = ref(null);
const listName = ref('');

const trimmedName = computed(() => listName.value.trim());
const canSubmit = computed(() => trimmedName.value.length > 0 && trimmedName.value !== props.currentName);

const close = () => {
  emit('update:visible', false);
};

const handleCancel = () => {
  close();
  emit('cancel');
};

const handleSave = () => {
  if (!canSubmit.value) {
    return;
  }

  emit('submit', trimmedName.value);
  close();
};

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      listName.value = props.currentName;
      nextTick(() => nameInput.value?.focus());
    }
  }
);
</script>

<template>
  <ModalBase
    :open="visible"
    title="Rename List"
    :subtitle="`Currently named '${currentName}'`"
    size="small"
    @update:open="$emit('update:visible', $event)"
    @close="handleCancel"
  >
    <template #default>
      <form class="rename-list" @submit.prevent="handleSave">
        <label class="rename-list__field" for="rename-list-name">New name</label>
        <input
          id="rename-list-name"
          ref="nameInput"
          v-model="listName"
          class="rename-list__input"
          type="text"
          name="renameListName"
          maxlength="80"
          placeholder="Ex: Work"
        >
      </form>
    </template>

    <template #actions>
      <div class="rename-list__actions">
        <button type="button" class="rename-list__button rename-list__button--ghost" @click="handleCancel">
          Cancel
        </button>
        <button type="button" class="rename-list__button rename-list__button--primary" :disabled="!canSubmit" @click="handleSave">
          Rename
        </button>
      </div>
    </template>
  </ModalBase>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.rename-list {
  display: grid;
  gap: 0.5rem;
}

.rename-list__field {
  font-weight: 700;
  font-size: 0.85rem;
  color: theme.$color-text-primary;
}

.rename-list__input {
  @include theme.modal-form-input;
  width: 100%;
}

.rename-list__actions {
  @include theme.modal-actions;
}

.rename-list__button {
  @include theme.modal-action-button;
}

.rename-list__button--ghost {
  background: transparent;
  border-color: theme.$color-border-muted;
  color: theme.$color-text-muted;

  &:hover:not(:disabled) {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(255, 255, 255, 0.04);
  }
}

.rename-list__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
