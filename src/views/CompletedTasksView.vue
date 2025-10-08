<script setup>
import { computed } from 'vue';
import { useTaskStore } from '../stores/useTaskStore';

const { sortedCompletedTasks } = useTaskStore();

const displayEntries = computed(() => sortedCompletedTasks.value);

const formatTimestamp = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};
</script>

<template>
  <section class="history">
    <header class="history__header">
      <h2>Completed Tasks</h2>
      <span class="history__count">{{ displayEntries.length }} saved</span>
    </header>
    <p v-if="displayEntries.length === 0" class="history__empty">
      No completed tasks yet. Finish a task to see it here.
    </p>
    <ul v-else class="history__list">
      <li v-for="entry in displayEntries" :key="entry.taskId" class="history__item">
        <div class="history__item-header">
          <span class="history__title">{{ entry.title }}</span>
          <time class="history__timestamp" :datetime="entry.completedAt">
            Completed {{ formatTimestamp(entry.completedAt) }}
          </time>
        </div>
        <p v-if="entry.description" class="history__description">
          {{ entry.description }}
        </p>
        <time
          v-if="entry.due"
          class="history__due"
          :datetime="entry.due"
        >
          Original due: {{ formatTimestamp(entry.due) }}
        </time>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.history {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid rgba(39, 52, 73, 0.45);
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.35);
  box-shadow: 0 18px 32px -28px rgba(15, 23, 42, 0.9);

  @media (max-width: 640px) {
    padding: 1rem;
  }
}

.history__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.history__count {
  color: #94a3b8;
  font-size: 0.95rem;
}

.history__empty {
  margin: 0;
  padding: 1rem 0;
  color: #94a3b8;
}

.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}

.history__item {
  border: 1px solid rgba(39, 52, 73, 0.45);
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  background: rgba(15, 23, 42, 0.65);
  display: grid;
  gap: 0.5rem;
}

.history__item-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.history__title {
  font-weight: 600;
}

.history__timestamp {
  color: #94a3b8;
  font-size: 0.85rem;
}

.history__description {
  margin: 0;
  color: #e2e8f0;
  opacity: 0.85;
}

.history__due {
  color: #38bdf8;
  font-size: 0.85rem;
}
</style>
