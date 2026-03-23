<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import ModalBase from './ModalBase.vue';
import IconGlyph from './IconGlyph.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  list: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:visible', 'save', 'cancel']);

const defaultReminderOffset = ref('none');
const panel = ref(null);

const reminderOptions = [
  { value: 'none', label: 'No reminder' },
  { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '240', label: '4 hours before' },
  { value: '1440', label: '1 day before' },
];

const resetForm = () => {
  defaultReminderOffset.value = 'none';
};

const applyList = (list) => {
  if (!list) {
    resetForm();
    return;
  }

  const minutes = Number(list.defaultReminderOffsetMinutes);
  if (Number.isFinite(minutes) && minutes > 0) {
    defaultReminderOffset.value = String(minutes);
  } else {
    defaultReminderOffset.value = 'none';
  }
};

const close = () => {
  emit('update:visible', false);
};

const handleCancel = () => {
  close();
  emit('cancel');
};

const handleSave = () => {
  if (!props.list) {
    close();
    return;
  }

  const settings = {
    defaultReminderOffsetMinutes: defaultReminderOffset.value === 'none' 
      ? null 
      : Number(defaultReminderOffset.value),
  };

  emit('save', {
    listId: props.list.id,
    settings,
  });
  close();
};

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      applyList(props.list);
      nextTick(() => panel.value?.focus());
    }
  }
);

watch(
  () => props.list,
  (newList) => {
    if (props.visible) {
      applyList(newList);
    }
  }
);
</script>

<template>
  <ModalBase
    :open="visible"
    title="List Settings"
    :subtitle="list?.name"
    size="medium"
    @update:open="$emit('update:visible', $event)"
    @close="handleCancel"
  >
    <template #default>
      <div class="list-settings__body">
        <label class="list-settings__field">
          <span class="list-settings__label">
            <IconGlyph
              name="bell"
              size="14"
              class="list-settings__label-icon"
              aria-hidden="true"
            />
            <span>Default Reminder</span>
          </span>
          <select
            v-model="defaultReminderOffset"
            class="list-settings__select"
            name="defaultReminder"
            aria-label="Default reminder time"
          >
            <option v-for="option in reminderOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <p class="list-settings__help-text">
            New tasks added to this list will have this reminder set by default
          </p>
        </label>
      </div>
    </template>

    <template #actions>
      <div class="list-settings__actions">
        <button
          type="button"
          class="list-settings__button list-settings__button--primary"
          @click="handleSave"
        >
          Save
        </button>
      </div>
    </template>
  </ModalBase>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.list-settings {
  &__body {
    @include theme.modal-fields;
  }

  &__field {
    display: grid;
    gap: 0.5rem;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 0.9rem;
    color: theme.$color-text-primary;
  }

  &__label-icon {
    color: theme.$color-text-muted;
  }

  &__select {
    @include theme.modal-form-input;
    padding: 0.65rem 0.75rem;
    font-size: 0.95rem;
    width: 100%;
  }

  &__help-text {
    margin: 0;
    font-size: 0.8rem;
    color: theme.$color-text-muted;
    line-height: 1.5;
  }

  &__actions {
    @include theme.modal-actions;
  }

  &__button {
    @include theme.modal-action-button;
  }
}
</style>
