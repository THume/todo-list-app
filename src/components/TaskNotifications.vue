<script setup>
import { computed } from 'vue';

const props = defineProps({
  notifications: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['dismiss', 'action']);

const hasNotifications = computed(() => props.notifications.length > 0);

const handleDismiss = (id) => {
  emit('dismiss', id);
};

const handleAction = (id, action) => {
  emit('action', { id, action });
};

const resolveActions = (note) => {
  if (Array.isArray(note?.actions) && note.actions.length > 0) {
    return note.actions;
  }
  if (note?.action) {
    return [note.action];
  }
  return [];
};
</script>

<template>
  <section v-if="hasNotifications" class="notifications">
    <transition-group name="notification" tag="ul" class="notifications__list">
      <li v-for="note in notifications" :key="note.id" class="notifications__item">
        <span class="notifications__message">{{ note.message }}</span>
        <div class="notifications__actions">
          <button
            v-for="(action, index) in resolveActions(note)"
            :key="`${note.id}-action-${index}`"
            type="button"
            class="notifications__action"
            @click="handleAction(note.id, action)"
          >
            {{ action.label }}
          </button>
          <button type="button" class="notifications__dismiss" @click="handleDismiss(note.id)">
            Dismiss
          </button>
        </div>
      </li>
    </transition-group>
  </section>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;
.notifications {
  position: fixed;
  inset: auto 1.25rem 1.25rem auto;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: flex-end;
  width: min(26rem, calc(100vw - 2.5rem));
  box-sizing: border-box;
  pointer-events: none;
  z-index: 1000;
}

.notifications__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  width: 100%;
  pointer-events: auto;
}

.notifications__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: rgba(23, 23, 24, 0.92);
  border: 1px solid theme.$color-border-muted;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  color: theme.$color-text-primary;
  box-shadow: 0 12px 18px -20px rgba(0, 0, 0, 0.7);
}

.notifications__message {
  flex: 1 1 auto;
  margin: 0;
}

.notifications__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.notifications__action {
  border: 1px solid theme.$color-border-muted;
  background: transparent;
  color: theme.$color-text-primary;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.35rem 0.9rem;
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

.notifications__dismiss {
  border: none;
  background: theme.$color-accent;
  color: theme.$color-text-inverted;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: 0 10px 18px -18px rgba(239, 68, 68, 0.75);
}

.notifications__dismiss:hover {
  transform: translateY(-1px);
  background: theme.$color-accent-hover;
}

.notification-enter-active,
.notification-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.notification-enter-from,
.notification-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
