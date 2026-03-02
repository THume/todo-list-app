<script setup>
import { computed, nextTick, ref, watch } from 'vue';
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
const uniqueId = Math.random().toString(36).slice(2);
const titleId = `list-settings-title-${uniqueId}`;

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
  <transition name="dialog-fade">
    <div
      v-if="visible"
      class="list-settings"
      role="presentation"
      @click.self="handleCancel"
    >
      <div
        ref="panel"
        class="list-settings__panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown.esc.prevent="handleCancel"
      >
        <header class="list-settings__header">
          <div class="list-settings__title-row">
            <IconGlyph
              name="settings"
              size="20"
              class="list-settings__title-icon"
              aria-hidden="true"
            />
            <h2 :id="titleId" class="list-settings__title">
              List Settings
            </h2>
          </div>
          <p v-if="list" class="list-settings__list-name">{{ list.name }}</p>
        </header>

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

        <div class="list-settings__actions">
          <button
            type="button"
            class="list-settings__button list-settings__button--cancel"
            @click="handleCancel"
          >
            Cancel
          </button>
          <button
            type="button"
            class="list-settings__button list-settings__button--primary"
            @click="handleSave"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

$dialog-backdrop: theme.$color-overlay-strong;
$dialog-panel-bg: theme.$color-surface-elevated;
$dialog-border: theme.$color-border-strong;
$input-text: theme.$color-text-primary;
$muted-text: theme.$color-text-muted;
$focus-outline: theme.$color-accent;
$primary-bg: theme.$color-accent;
$primary-bg-hover: theme.$color-accent-hover;
$primary-text: theme.$color-text-inverted;

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.list-settings {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: $dialog-backdrop;
  z-index: 1000;
  padding: 1.5rem;
  box-sizing: border-box;

  @media (max-width: 768px) {
    align-items: flex-start;
    padding-top: 72px;
  }

  &__panel {
    width: min(100%, 28rem);
    background: $dialog-panel-bg;
    border-radius: 1rem;
    border: 1px solid $dialog-border;
    padding: 1.75rem;
    box-shadow: 0 24px 40px -28px rgba(0, 0, 0, 0.7);
    display: grid;
    gap: 1.5rem;
    outline: none;
  }

  &__header {
    display: grid;
    gap: 0.5rem;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  &__title-icon {
    color: $muted-text;
  }

  &__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: $input-text;
  }

  &__list-name {
    margin: 0;
    font-size: 0.95rem;
    color: $muted-text;
    padding-left: 2rem;
  }

  &__body {
    display: grid;
    gap: 1.25rem;
  }

  &__field {
    display: grid;
    gap: 0.5rem;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    color: $input-text;
  }

  &__label-icon {
    color: $muted-text;
  }

  &__select {
    border-radius: 0.5rem;
    border: 1px solid $dialog-border;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    color: $input-text;
    background: $dialog-panel-bg;
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
    outline: none;
    transition: border-color 0.2s ease;

    &:focus-visible {
      border-color: $focus-outline;
    }
  }

  &__help-text {
    margin: 0;
    font-size: 0.8rem;
    color: $muted-text;
    line-height: 1.5;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
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

    &:active {
      transform: translateY(1px);
    }

    &--cancel {
      background: rgba(255, 255, 255, 0.08);
      color: $input-text;

      &:hover {
        background: rgba(255, 255, 255, 0.12);
      }
    }

    &--primary {
      background: $primary-bg;
      color: $primary-text;
      box-shadow: 0 4px 8px -4px rgba(239, 68, 68, 0.4);

      &:hover {
        background: $primary-bg-hover;
        box-shadow: 0 6px 12px -4px rgba(239, 68, 68, 0.5);
      }
    }
  }
}
</style>
