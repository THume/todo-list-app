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
  max-width: 48rem;
  margin: 1.5rem auto 0;
  padding: 0 1.5rem;
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
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid #273449;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  color: #f8fafc;
  box-shadow: 0 12px 18px -18px rgba(15, 23, 42, 0.8);
}

.notifications__message {
  flex: 1 1 auto;
  margin: 0;
}

.notifications__dismiss {
  border: none;
  background: #0ea5e9;
  color: #0f172a;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: 0 10px 18px -16px rgba(14, 165, 233, 0.8);
}

.notifications__dismiss:hover {
  transform: translateY(-1px);
  background: #38bdf8;
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
