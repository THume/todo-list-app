<script setup>
import { computed } from 'vue';

const props = defineProps({
  notifications: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['dismiss']);

const hasNotifications = computed(() => props.notifications.length > 0);

const handleDismiss = (id) => {
  emit('dismiss', id);
};
</script>

<template>
  <section v-if="hasNotifications" class="notifications">
    <transition-group name="notification" tag="ul" class="notifications__list">
      <li v-for="note in notifications" :key="note.id" class="notifications__item">
        <span class="notifications__message">{{ note.message }}</span>
        <button type="button" class="notifications__dismiss" @click="handleDismiss(note.id)">
          Dismiss
        </button>
      </li>
    </transition-group>
  </section>
</template>

<style scoped lang="scss">
.notifications {
  max-width: 64rem;
  margin: 1.5rem clamp(1.5rem, 5vw, 3rem) 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  box-sizing: border-box;
}

.notifications__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.notifications__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: rgba(23, 23, 24, 0.92);
  border: 1px solid #272727;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  color: #f5f5f5;
  box-shadow: 0 12px 18px -20px rgba(0, 0, 0, 0.7);
}

.notifications__message {
  flex: 1 1 auto;
  margin: 0;
}

.notifications__dismiss {
  border: none;
  background: #ef4444;
  color: #0b0b0c;
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
  background: #f87171;
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
