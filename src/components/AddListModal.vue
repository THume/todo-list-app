<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import ModalBase from './ModalBase.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:visible', 'submit', 'cancel']);

const nameInput = ref(null);
const listName = ref('');

const trimmedName = computed(() => listName.value.trim());
const canSubmit = computed(() => trimmedName.value.length > 0);

const close = () => {
  emit('update:visible', false);
};

const resetForm = () => {
  listName.value = '';
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
      resetForm();
      nextTick(() => nameInput.value?.focus());
    }
  }
);
</script>

<template>
  <ModalBase
    :open="visible"
    title="Create List"
    subtitle="Give your new list a short name"
    size="small"
    @update:open="$emit('update:visible', $event)"
    @close="handleCancel"
  >
    <template #default>
      <form class="add-list" @submit.prevent="handleSave">
        <label class="add-list__field" for="new-list-name">List name</label>
        <input
          id="new-list-name"
          ref="nameInput"
          v-model="listName"
          class="add-list__input"
          type="text"
          name="newListName"
          maxlength="80"
          placeholder="Ex: Work"
        >
      </form>
    </template>

    <template #actions>
      <div class="add-list__actions">
        <button type="button" class="add-list__button add-list__button--ghost" @click="handleCancel">
          Cancel
        </button>
        <button type="button" class="add-list__button add-list__button--primary" :disabled="!canSubmit" @click="handleSave">
          Create List
        </button>
      </div>
    </template>
  </ModalBase>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.add-list {
  display: grid;
  gap: 0.5rem;
}

.add-list__field {
  font-weight: 700;
  font-size: 0.85rem;
  color: theme.$color-text-primary;
}

.add-list__input {
  @include theme.modal-form-input;
  width: 100%;
}

.add-list__actions {
  @include theme.modal-actions;
}

.add-list__button {
  @include theme.modal-action-button;
}

.add-list__button--ghost {
  background: transparent;
  border-color: theme.$color-border-muted;
  color: theme.$color-text-muted;

  &:hover:not(:disabled) {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(255, 255, 255, 0.04);
  }
}

.add-list__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
