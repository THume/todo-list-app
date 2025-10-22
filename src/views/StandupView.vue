<script setup>
import { computed } from 'vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  tasksDueToday,
  tasksCompletedYesterday,
  tasksCompletedToday,
  lists,
} = useTaskStore();

const listNameById = computed(() => {
  const result = {};
  const availableLists = Array.isArray(lists.value) ? lists.value : [];
  availableLists.forEach((list) => {
    if (list && typeof list.id === 'string') {
      const name =
        typeof list.name === 'string' && list.name.trim().length > 0
          ? list.name.trim()
          : 'My Tasks';
      result[list.id] = name;
    }
  });
  if (!result.default) {
    result.default = 'My Tasks';
  }
  return result;
});

const resolveListName = (listId) => {
  if (typeof listId === 'string' && listId in listNameById.value) {
    return listNameById.value[listId];
  }
  return listNameById.value.default ?? 'My Tasks';
};

const standupDateLabel = computed(() => {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
  }).format(new Date());
});

const completedYesterday = computed(() => {
  return Array.isArray(tasksCompletedYesterday.value)
    ? tasksCompletedYesterday.value
    : [];
});

const completedToday = computed(() => {
  return Array.isArray(tasksCompletedToday.value)
    ? tasksCompletedToday.value
    : [];
});

const todayTasks = computed(() => {
  const tasks = Array.isArray(tasksDueToday.value) ? [...tasksDueToday.value] : [];
  return tasks.sort((a, b) => {
    const aTime = Date.parse(a?.due ?? '');
    const bTime = Date.parse(b?.due ?? '');

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
      return String(a?.title ?? '').localeCompare(String(b?.title ?? ''));
    }
    if (Number.isNaN(aTime)) {
      return 1;
    }
    if (Number.isNaN(bTime)) {
      return -1;
    }
    return aTime - bTime;
  });
});

const completedCount = computed(() => completedYesterday.value.length);
const scheduledTodayCount = computed(() => todayTasks.value.length);
const completedTodayCount = computed(() => completedToday.value.length);
const todayTotalCount = computed(
  () => scheduledTodayCount.value + completedTodayCount.value
);

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

const formatTimeOnly = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    timeStyle: 'short',
  }).format(date);
};
</script>

<template>
  <section class="standup">
    <header class="standup__header">
      <div>
        <h1 class="standup__title">Standup Overview</h1>
        <p class="standup__subtitle">
          Snapshot for {{ standupDateLabel }}
        </p>
      </div>
    </header>
    <div class="standup__grid">
      <article class="standup__section">
        <header class="standup__section-header">
          <h2>Completed Yesterday</h2>
          <span class="standup__count">{{ completedCount }}</span>
        </header>
        <p v-if="completedCount === 0" class="standup__empty">
          No completed tasks logged yesterday.
        </p>
        <ul v-else class="standup__list">
          <li v-for="entry in completedYesterday" :key="entry.taskId" class="standup__item">
            <div class="standup__item-header">
              <span class="standup__item-title">{{ entry.title }}</span>
              <time class="standup__item-meta" :datetime="entry.completedAt">
                Completed {{ formatTimestamp(entry.completedAt) }}
              </time>
            </div>
            <p v-if="entry.description" class="standup__item-description">
              {{ entry.description }}
            </p>
            <time
              v-if="entry.due"
              class="standup__item-meta"
              :datetime="entry.due"
            >
              Originally due {{ formatTimestamp(entry.due) }}
            </time>
            <span class="standup__badge">List: {{ resolveListName(entry.listId) }}</span>
          </li>
        </ul>
      </article>
      <article class="standup__section">
        <header class="standup__section-header">
          <h2>Today&rsquo;s Focus</h2>
          <span class="standup__count">{{ todayTotalCount }}</span>
        </header>
        <p v-if="todayTotalCount === 0" class="standup__empty">
          No tasks scheduled or completed yet today. Great job staying ahead!
        </p>
        <div v-else class="standup__focus">
          <section v-if="completedTodayCount > 0" class="standup__focus-group">
            <h3 class="standup__subheading">Completed Today</h3>
            <ul class="standup__list">
              <li v-for="entry in completedToday" :key="entry.taskId" class="standup__item">
                <div class="standup__item-header">
                  <span class="standup__item-title">{{ entry.title }}</span>
                  <time class="standup__item-meta" :datetime="entry.completedAt">
                    Completed at {{ formatTimeOnly(entry.completedAt) }}
                  </time>
                </div>
                <p v-if="entry.description" class="standup__item-description">
                  {{ entry.description }}
                </p>
                <time
                  v-if="entry.due"
                  class="standup__item-meta"
                  :datetime="entry.due"
                >
                  Was due {{ formatTimestamp(entry.due) }}
                </time>
                <div class="standup__meta-row">
                  <span class="standup__badge">List: {{ resolveListName(entry.listId) }}</span>
                  <span v-if="entry.recurrence" class="standup__badge standup__badge--info">
                    Repeats: {{ entry.recurrence }}
                  </span>
                </div>
              </li>
            </ul>
          </section>
          <section v-if="scheduledTodayCount > 0" class="standup__focus-group">
            <h3 class="standup__subheading">Scheduled</h3>
            <ul class="standup__list">
              <li v-for="task in todayTasks" :key="task.id" class="standup__item">
                <div class="standup__item-header">
                  <span class="standup__item-title">{{ task.title }}</span>
                  <time class="standup__item-meta" :datetime="task.due">
                    Due {{ formatTimeOnly(task.due) }}
                  </time>
                </div>
                <p v-if="task.description" class="standup__item-description">
                  {{ task.description }}
                </p>
                <div class="standup__meta-row">
                  <span class="standup__badge">List: {{ resolveListName(task.listId) }}</span>
                  <span v-if="task.recurrence" class="standup__badge standup__badge--info">
                    Repeats: {{ task.recurrence }}
                  </span>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.standup {
  display: grid;
  gap: 1.5rem;
}

.standup__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.standup__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: theme.$color-text-heading;
}

.standup__subtitle {
  margin: 0.2rem 0 0;
  color: theme.$color-text-muted;
}

.standup__grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
}

.standup__section {
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  background: rgba(23, 23, 24, 0.6);
  box-shadow: 0 18px 32px -28px rgba(0, 0, 0, 0.85);
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
  grid-template-rows: min-content auto;
}

.standup__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;

  h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
  }
}

.standup__count {
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.standup__empty {
  margin: 0;
  padding: 1.25rem;
  border: 2px dashed theme.$color-border-input;
  border-radius: 0.75rem;
  color: theme.$color-text-muted;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
}

.standup__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  grid-auto-rows: min-content;
}

.standup__focus {
  display: grid;
  gap: 1.25rem;
}

.standup__focus-group {
  display: grid;
  gap: 0.75rem;
}

.standup__subheading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.standup__item {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  background: rgba(12, 12, 13, 0.55);
  display: grid;
  gap: 0.5rem;
}

.standup__item-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.standup__item-title {
  font-weight: 600;
  color: theme.$color-text-primary;
}

.standup__item-meta {
  color: theme.$color-text-muted;
  font-size: 0.85rem;
}

.standup__item-description {
  margin: 0;
  color: #d4d4d8;
  opacity: 0.85;
}

.standup__meta-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.standup__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.18);
  color: #93c5fd;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.standup__badge--info {
  background: rgba(16, 185, 129, 0.18);
  color: #6ee7b7;
}
</style>
